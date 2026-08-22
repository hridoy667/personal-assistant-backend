import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateMoodLogDto } from './dto/health-log.dto';
import { calculateAge } from 'src/common/utils/date-helper.util';
import { calculateBMR, calculateDynamicHydration, calculateTDEE, getOutdoorAdvisory, HealthProfile, WeatherContext } from 'src/common/utils/health-science.util';
import { DashboardService } from '../dashbord/dashboard.service';
import { InjectRedis } from '@nestjs-modules/ioredis';
import Redis from 'ioredis';
import { startOfDay, endOfDay, setHours, setMinutes, parse, subDays, addDays } from 'date-fns';

@Injectable()
export class HealthService {
  constructor(private readonly prisma: PrismaService,
    private readonly dashboardService: DashboardService,
    @InjectRedis() private readonly redis: Redis,
  ) { }

  private readonly logger = new Logger(DashboardService.name);


  async getHealthHistory(userId: string, days = 30) {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    startDate.setUTCHours(0, 0, 0, 0);

    return this.prisma.healthLog.findMany({
      where: {
        userId,
        date: {
          gte: startDate,
        },
      },
      orderBy: { date: 'desc' },
    });
  }


  async getWellbeingContext(userId: string, latitude?: number, longitude?: number) {
    // 1. Fetch physical profile from DB
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        height: true,
        weight: true,
        dateOfBirth: true,
        gender: true,
        activityLevel: true,
        district: true,
      },
    });

    // Profile completeness check
    if (!user || !user.height || !user.weight || !user.dateOfBirth) {
      return {
        success: false,
        message: 'Please update your height, weight, and date of birth in your profile to access wellbeing insights.',
        isUpdateRequired: true,
      };
    }

    // 2. Construct Location-Aware Redis Cache Key
    let locationKeySegment = 'default';
    if (latitude !== undefined && longitude !== undefined) {
      locationKeySegment = `coords:${latitude.toFixed(2)}:${longitude.toFixed(2)}`;
    } else if (user.district) {
      locationKeySegment = `district:${user.district.trim().toLowerCase()}`;
    }

    const cacheKey = `wellbeing:user:${userId}:${locationKeySegment}`;

    // 3. Attempt Redis Cache Retrieval
    try {
      const cachedData = await this.redis.get(cacheKey);
      if (cachedData) {
        return {
          ...JSON.parse(cachedData),
          cached: true,
        };
      }
    } catch (redisError) {
      this.logger.error('Redis cache read error in wellbeing service:', redisError);
    }

    // 4. Fetch live environmental context using DashboardService
    const weatherData = await this.dashboardService.getWeatherByPlace(userId, latitude, longitude);

    // 5. Map user & environmental data to Health Science domain models
    const ageYears = calculateAge(user.dateOfBirth);
    const heightMeters = user.height;
    const weightKg = user.weight;

    const healthProfile: HealthProfile = {
      weightKg,
      heightMeters,
      ageYears,
      gender: (user.gender as HealthProfile['gender']) || 'OTHER',
      activityLevel: (user.activityLevel as HealthProfile['activityLevel']) || 'SEDENTARY',
    };

    const weatherContext: WeatherContext = {
      tempFeelsLike: weatherData.thermalComfort.feelsLike,
      humidity: weatherData.thermalComfort.humidity,
      pressure: weatherData.mentalAndHealthMetrics.pressure,
      uvIndex: weatherData.mentalAndHealthMetrics.uvIndex,
      aqi: weatherData.mentalAndHealthMetrics.airQualityIndex,
      pm25: weatherData.mentalAndHealthMetrics.pollutants?.pm2_5 ?? null,
      isDaylight: weatherData.condition.isDaylight,
      sunrise: weatherData.productivityAndWorkouts.sunrise,
      sunset: weatherData.productivityAndWorkouts.sunset,
    };

    // 6. Compute evidence-based physiological & environmental insights
    const bmiScore = Number((weightKg / (heightMeters * heightMeters)).toFixed(1));
    const hydration = calculateDynamicHydration(healthProfile, weatherContext);
    const bmr = calculateBMR(healthProfile);
    const tdee = calculateTDEE(healthProfile, weatherContext);
    const outdoorAdvisory = getOutdoorAdvisory(weatherContext);

    // 7. Structure final response payload
    const wellbeingPayload = {
      success: true,
      data: {
        location: weatherData.location,
        userProfile: {
          age: ageYears,
          bmi: bmiScore,
          gender: healthProfile.gender,
          activityLevel: healthProfile.activityLevel,
        },
        metabolicMetrics: {
          bmr,
          tdee,
          tdeeNote:
            weatherContext.tempFeelsLike < 10
              ? 'TDEE adjusted +5% due to cold thermogenesis.'
              : 'Standard metabolic expenditure.',
        },
        hydration: {
          targetMl: hydration.recommendedMl,
          breakdown: hydration.breakdown,
        },
        workoutAdvisory: {
          isOutdoorExerciseRecommended: outdoorAdvisory.isOutdoorExerciseRecommended,
          warnings: outdoorAdvisory.warnings,
        },
        healthInsights: outdoorAdvisory.insights,
        activeWeatherAlerts: weatherData.alertsAndAdvisories.alerts,
      },
    };

    // 8. Save to Redis Cache for 1.5 Hours (5400 seconds)
    try {
      await this.redis.set(cacheKey, JSON.stringify(wellbeingPayload), 'EX', 5400);
    } catch (redisSetError) {
      this.logger.error('Redis cache write error in wellbeing service:', redisSetError);
    }

    return {
      ...wellbeingPayload,
      cached: false,
    };
  }

  async getActiveSleepSession(userId: string) {
    return this.prisma.sleepLog.findFirst({
      where: {
        userId,
        wokeUpAt: null,
      },
      orderBy: {
        sleptAt: 'desc',
      },
    });
  }

  /**
   * Start a new sleep session ("Going to Sleep")
   */
  async startSleepSession(userId: string, sleptAt?: string) {
    // Close any previous abandoned sessions to ensure clean state
    await this.prisma.sleepLog.updateMany({
      where: {
        userId,
        wokeUpAt: null,
      },
      data: {
        wokeUpAt: new Date(),
        isFallback: true,
      },
    });

    return this.prisma.sleepLog.create({
      data: {
        userId,
        sleptAt: sleptAt ? new Date(sleptAt) : new Date(),
      },
    });
  }

  /**
   * End an ongoing sleep session ("I'm Awake")
   */
  async wakeUpSession(userId: string, sessionId: string, wokeUpAt?: string) {
    const existingSession = await this.prisma.sleepLog.findUnique({
      where: { id: sessionId },
    });

    if (!existingSession || existingSession.userId !== userId) {
      throw new NotFoundException('Active sleep session not found');
    }

    return this.prisma.sleepLog.update({
      where: { id: sessionId },
      data: {
        wokeUpAt: wokeUpAt ? new Date(wokeUpAt) : new Date(),
      },
    });
  }

  /**
   * Cron Job Helper: Auto-close abandoned sleep sessions older than 18 hours
   */
  async handleMissedSleepLogs() {
    const eighteenHoursAgo = new Date(Date.now() - 18 * 60 * 60 * 1000);

    const abandonedLogs = await this.prisma.sleepLog.findMany({
      where: {
        wokeUpAt: null,
        sleptAt: { lte: eighteenHoursAgo },
      },
      include: { user: true },
    });

    for (const log of abandonedLogs) {
      const defaultWake = log.user?.defaultWakeTime || '06:00';
      const [wakeH, wakeM] = defaultWake.split(':').map(Number);
      const estimatedWake = setMinutes(
        setHours(addDays(log.sleptAt, 1), wakeH),
        wakeM,
      );

      await this.prisma.sleepLog.update({
        where: { id: log.id },
        data: {
          wokeUpAt: estimatedWake,
          isFallback: true,
        },
      });
    }
  }

}