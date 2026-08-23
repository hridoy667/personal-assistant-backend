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
  Logger,
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



@Injectable()
export class DashboardService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly httpService: HttpService,
    @InjectRedis() private readonly redis: Redis,
  ) { }
  private readonly logger = new Logger(DashboardService.name);
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
      return JSON.parse(cachedData);
    }
    console.log(
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

  async getWeatherByPlace(userId: string, latitude?: number, longitude?: number) {
    // 1. Fetch User from DB
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { name: true, location: true },
    });

    let targetLat = latitude;
    let targetLon = longitude;
    let locationName = '';
    let countryCode = '';
    let redisKey = '';

    // 2. Determine Coordinates Source & Construct Redis Key
    if (targetLat !== undefined && targetLon !== undefined) {
      const roundedLat = targetLat.toFixed(2);
      const roundedLon = targetLon.toFixed(2);
      redisKey = `weather:coords:${roundedLat}:${roundedLon}`;
    } else if (user?.location) {
      const districtClean = user.location.trim();
      redisKey = `weather:district:${districtClean.toLowerCase()}`;
    } else {
      throw new BadRequestException({
        success: false,
        requiresLocationAccess: true,
      });
    }

    // 3. Check Redis Cache First (2-Hour TTL ensures minimum external API calls)
    try {
      const cachedWeather = await this.redis.get(redisKey);
      if (cachedWeather) {
        return {
          ...JSON.parse(cachedWeather),
          userName: user?.name ?? 'User',
          cached: true,
        };
      }
    } catch (redisError) {
      this.logger.error('Redis read error:', redisError);
    }

    // 4. Resolve Coordinates if using District Name
    const apiKey = process.env.OPENWEATHER_API_KEY;
    if (!apiKey) {
      throw new HttpException('Weather API key missing.', HttpStatus.INTERNAL_SERVER_ERROR);
    }

    try {
      if (targetLat === undefined || targetLon === undefined) {
        const geoUrl = `https://api.openweathermap.org/geo/1.0/direct?q=${encodeURIComponent(
          user!.location!.trim(),
        )}&limit=1&appid=${apiKey}`;

        const geoResponse = await firstValueFrom(this.httpService.get(geoUrl));
        const locations = geoResponse.data ?? [];

        if (locations.length === 0) {
          throw new NotFoundException(`Location '${user!.location}' could not be resolved.`);
        }

        targetLat = locations[0].lat;
        targetLon = locations[0].lon;
        locationName = locations[0].name;
        countryCode = locations[0].country;
      }

      // 5. Parallel Fetch: Current Weather + Air Pollution + One Call 3.0 (for Alerts & UV Index)
      const weatherUrl = `https://api.openweathermap.org/data/2.5/weather?lat=${targetLat}&lon=${targetLon}&units=metric&appid=${apiKey}`;
      const airPollutionUrl = `https://api.openweathermap.org/data/2.5/air_pollution?lat=${targetLat}&lon=${targetLon}&appid=${apiKey}`;
      const oneCallUrl = `https://api.openweathermap.org/data/3.0/onecall?lat=${targetLat}&lon=${targetLon}&exclude=minutely,hourly,daily&units=metric&appid=${apiKey}`;

      const [weatherResponse, airResponse, oneCallResponse] = await Promise.all([
        firstValueFrom(this.httpService.get(weatherUrl)),
        firstValueFrom(this.httpService.get(airPollutionUrl)).catch(() => ({ data: null })),
        firstValueFrom(this.httpService.get(oneCallUrl)).catch(() => ({ data: null })),
      ]);

      const weather = weatherResponse.data;
      const airData = airResponse.data?.list?.[0];
      const oneCallData = oneCallResponse.data;

      const finalLocation = locationName
        ? `${locationName}, ${countryCode}`
        : `${weather.name}, ${weather.sys?.country}`;

      // --- Persist Location to User Profile ---
      // If user's location is not set or changed, update Prisma asynchronously
      if (userId && user?.location !== finalLocation) {
        this.prisma.user
          .update({
            where: { id: userId },
            data: { location: finalLocation },
          })
          .catch((dbError) => {
            this.logger.error('Failed to auto-update user location:', dbError);
          });
      }

      // Daylight progress
      const sunrise = weather.sys?.sunrise;
      const sunset = weather.sys?.sunset;
      const currentTime = weather.dt || Math.floor(Date.now() / 1000);
      const isDaylight = currentTime >= sunrise && currentTime <= sunset;

      // Parse Weather Alerts
      const rawAlerts = oneCallData?.alerts || [];
      const activeAlerts = rawAlerts.map((alert: any) => ({
        senderName: alert.sender_name,
        event: alert.event,
        start: alert.start,
        end: alert.end,
        description: alert.description,
        tags: alert.tags || [],
      }));

      // 6. Build Comprehensive Health, Mental & Advisory Payload
      const weatherPayload = {
        success: true,
        location: finalLocation,
        coordinates: { latitude: targetLat, longitude: targetLon },
        condition: {
          id: weather.weather?.[0]?.id,
          main: weather.weather?.[0]?.main,
          summary: weather.weather?.[0]?.description,
          icon: weather.weather?.[0]?.icon,
          isDaylight,
        },
        thermalComfort: {
          temperature: weather.main?.temp,
          feelsLike: weather.main?.feels_like,
          tempMin: weather.main?.temp_min,
          tempMax: weather.main?.temp_max,
          humidity: weather.main?.humidity,
        },
        mentalAndHealthMetrics: {
          pressure: weather.main?.pressure,
          visibility: weather.visibility,
          cloudCover: weather.clouds?.all,
          uvIndex: oneCallData?.current?.uvi ?? null,
          airQualityIndex: airData?.main?.aqi ?? null,
          pollutants: {
            pm2_5: airData?.components?.pm2_5 ?? null,
            pm10: airData?.components?.pm10 ?? null,
          },
        },
        productivityAndWorkouts: {
          windSpeed: weather.wind?.speed,
          windGusts: weather.wind?.gust || null,
          precipitationAmount: weather.rain?.['1h'] || weather.snow?.['1h'] || 0,
          sunrise,
          sunset,
        },
        alertsAndAdvisories: {
          hasActiveAlerts: activeAlerts.length > 0,
          alerts: activeAlerts,
        },
      };

      // 7. Save to Redis Cache for 2 Hours (7200 seconds)
      try {
        await this.redis.set(redisKey, JSON.stringify(weatherPayload), 'EX', 7200);
      } catch (redisSetError) {
        this.logger.error('Redis set error:', redisSetError);
      }

      return {
        ...weatherPayload,
        userName: user?.name ?? 'User',
        cached: false,
      };
    } catch (error: any) {
      if (error instanceof HttpException) throw error;
      this.logger.error('Weather service failure:', error?.response?.data || error.message);
      throw new HttpException('Failed to retrieve weather data.', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  async getQuranAyat(userId: string) {
    const redisKey = `quran:random_ayat`; // Shared cache key
    const CACHE_TTL_SECONDS = 5400; // 1.5 hours

    const user = await this.prisma.user.findFirst({
      where: { id: userId },
      select: {
        name: true,
        enableIslamicFeatures: true,
      },
    });

    // 1. Check if user exists and explicitly has Islamic features enabled
    if (!user || user.enableIslamicFeatures !== true) {
      return {
        success: false,
        message: 'Islamic feature not enabled',
      };
    }

    // 2. Check Redis Cache
    try {
      const cachedAyat = await this.redis.get(redisKey);
      if (cachedAyat) {
        return {
          ...JSON.parse(cachedAyat),
          userName: user.name ?? 'User',
          cached: true,
        };
      }
    } catch (redisError) {
      this.logger.error('Redis read error:', redisError);
    }

    // 3. Fetch from External API
    const apiKey = process.env.QURAN_AYAT_API;
    try {
      const response = await fetch('https://ummahapi.com/api/quran/random', {
        headers: {
          Accept: 'application/json',
          ...(apiKey ? { 'x-api-key': apiKey } : {}),
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch Quran verse: ${response.statusText}`);
      }

      const result = await response.json();

      if (!result.success) {
        throw new Error('API returned an unsuccessful status.');
      }

      const { surah, verse, audio } = result.data;

      const ayatPayload = {
        success: true,
        surahName: surah.name_english,
        surahArabic: surah.name_arabic,
        verseKey: verse.verse_key,
        arabic: verse.arabic,
        translation: verse.translations.sahih_international,
        bengaliTranslation: verse.translations.bengali,
        audioUrl: audio?.[0]?.ayah_audio || null,
      };

      // 4. Save to Redis Cache with 1.5-Hour Expiry
      try {
        await this.redis.set(
          redisKey,
          JSON.stringify(ayatPayload),
          'EX',
          CACHE_TTL_SECONDS,
        );
      } catch (redisError) {
        this.logger.error('Redis write error:', redisError);
      }

      return {
        ...ayatPayload,
        userName: user.name ?? 'User',
        cached: false,
      };
    } catch (error: any) {
      this.logger.error('Error fetching Quran Ayat:', error.message);
      throw error;
    }
  }

  private async getAdminDashboard() {

  }

  private async getUserDashboard(userId: string) {

  }
}
