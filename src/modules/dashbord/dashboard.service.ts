/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/require-await */
/* eslint-disable @typescript-eslint/no-unsafe-return */
import {
  Injectable,
  NotFoundException,
  HttpException,
  HttpStatus,
  BadRequestException,
} from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { PrismaService } from '../prisma/prisma.service';
import { UserRole } from '@prisma/client';
import { getMonthRange } from 'src/common/utils/date-helper.util';
import { calculateGrowth } from 'src/common/utils/math-helper.util';
import {
  generateHarvestUrl,
  generateProductUrl,
} from 'src/common/utils/fileUrl.util';
import { InjectRedis } from '@nestjs-modules/ioredis';
import Redis from 'ioredis';
import {
  startOfMonth,
  endOfMonth,
  subMonths
} from 'date-fns';


@Injectable()
export class DashboardService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly httpService: HttpService,
    @InjectRedis() private readonly redis: Redis,
  ) { }

  async dashboard(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        type: true,
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    let cacheKey = `dashboard:user:${userId}`;
    if (user.type === UserRole.ADMIN) {
      cacheKey = `dashboard:admin:global`;
    }

    const cachedData = await this.redis.get(cacheKey);
    if (cachedData) {
      console.log(`🟢 [REDIS] Dashboard Cache Hit for key: ${cacheKey}`);
      return JSON.parse(cachedData);
    }
    console.log(
      `?. [REDIS] Dashboard Cache Miss! Fetching fresh data from DB...`,
    );

    let dashboardData;

     if (user.type === UserRole.ADMIN) {
      dashboardData = await this.getAdminDashboard();
    } else {
      dashboardData = await this.getUserDashboard(userId);
    }

    const result = {
      ...dashboardData,
    };

    await this.redis.set(cacheKey, JSON.stringify(result), 'EX', 1000);

    return result;
  }

  async getWeatherByPlace(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        name: true,
        district: true,
      },
    });

    if (!user || !user.district) {
      throw new NotFoundException('User district profile not found');
    }

    const districtKey = user.district.trim().toLowerCase();
    const redisKey = `weather:district:${districtKey}`;

    // ২. রেডিস ক্যাশ চেক করা
    try {
      const cachedWeather = await this.redis.get(redisKey);
      if (cachedWeather) {
        const weatherData = JSON.parse(cachedWeather);

        return {
          ...weatherData,
          farmerName: user.name,
          cached: true,
        };
      }
    } catch (redisError) {
      console.error('Redis error:', redisError);
    }

    const apiKey =
      process.env.WEATHER_API_KEY || 'c0vq6lizq1u6oulo7bylhawcjc5q0ipqbldcg5wq';
    const baseUrl = 'https://www.meteosource.com/api/v1/free';

    try {
      const geoUrl = `${baseUrl}/find_places?text=${encodeURIComponent(user.district.trim())}&language=en&key=${apiKey}`;
      const geoResponse = await firstValueFrom(this.httpService.get(geoUrl));

      const locations = geoResponse.data ?? [];
      if (locations.length === 0) {
        throw new HttpException(
          `Location '${user.district}' not verified.`,
          HttpStatus.NOT_FOUND,
        );
      }

      const { place_id, name, country, lat, lon } = locations[0];

      const weatherUrl = `${baseUrl}/point?place_id=${place_id}&sections=all&language=en&units=metric&key=${apiKey}`;
      const weatherResponse = await firstValueFrom(
        this.httpService.get(weatherUrl),
      );

      const currentWeather = weatherResponse.data?.current;

      const weatherPayload = {
        success: true,
        location: `${name}, ${country}`,
        coordinates: { latitude: lat, longitude: lon },
        temperature: currentWeather?.temperature,
        summary: currentWeather?.summary,
        icon_num: currentWeather?.icon_num,
        agriculture: {
          humidity: currentWeather?.humidity,
          precipitationAmount: currentWeather?.precipitation?.value,
          precipitationType: currentWeather?.precipitation?.type,
          dewPoint: currentWeather?.dew_point,
          windSpeed: currentWeather?.wind?.speed,
          windGusts: currentWeather?.wind?.gusts,
          windDirection: currentWeather?.wind?.dir,
          cloudCover: currentWeather?.cloud_cover,
          pressure: currentWeather?.pressure,
          irradiance: currentWeather?.irradiance,
        },
      };

      await this.redis.set(
        redisKey,
        JSON.stringify(weatherPayload),
        'EX',
        3600,
      );

      return {
        ...weatherPayload,
        farmerName: user.name,
        cached: false,
      };
    } catch (error: any) {
      if (error instanceof HttpException) throw error;
      throw new HttpException(
        error.response?.data?.detail || 'Meteosource weather service failure.',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  private async getAdminDashboard() {
    
  }

  private async getUserDashboard(userId: string) {
    return {
      totalIncome: 0,
      activeOrdersCount: 0,
    };
  }
}
