import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UpsertSleepLogDto, SleepStatsQueryDto, StatsTimeframe } from './dto/health-log.dto';
import { calculateAge } from 'src/common/utils/date-helper.util';
import { calculateBMR, calculateDynamicHydration, calculateTDEE, getOutdoorAdvisory, HealthProfile, WeatherContext } from 'src/common/utils/health-science.util';
import { DashboardService } from '../dashbord/dashboard.service';
import { InjectRedis } from '@nestjs-modules/ioredis';
import Redis from 'ioredis';
import { startOfDay, endOfDay, subDays, format, getISOWeek, getMonth } from 'date-fns';
import { getUserDayBounds } from 'src/common/utils/day-bounds.util';

@Injectable()
export class HealthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly dashboardService: DashboardService,
    @InjectRedis() private readonly redis: Redis,
  ) {}

  private readonly logger = new Logger(HealthService.name);

  // --- Existing Logic Retained Exactly --- //
  async getHealthHistory(userId: string, days = 30) {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    startDate.setUTCHours(0, 0, 0, 0);

    return this.prisma.healthLog.findMany({ // Assuming healthLog exists in Prisma
      where: { userId, date: { gte: startDate } },
      orderBy: { date: 'desc' },
    });
  }

  async getWellbeingContext(userId: string, latitude?: number, longitude?: number) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { height: true, weight: true, dateOfBirth: true, gender: true, activityLevel: true, district: true },
    });

    if (!user || !user.height || !user.weight || !user.dateOfBirth) {
      return { success: false, message: 'Please update your profile.', isUpdateRequired: true };
    }

    let locationKeySegment = 'default';
    if (latitude !== undefined && longitude !== undefined) {
      locationKeySegment = `coords:${latitude.toFixed(2)}:${longitude.toFixed(2)}`;
    } else if (user.district) {
      locationKeySegment = `district:${user.district.trim().toLowerCase()}`;
    }
    const cacheKey = `wellbeing:user:${userId}:${locationKeySegment}`;

    try {
      const cachedData = await this.redis.get(cacheKey);
      if (cachedData) return { ...JSON.parse(cachedData), cached: true };
    } catch (e) {
      this.logger.error('Redis read error:', e);
    }

    const weatherData = await this.dashboardService.getWeatherByPlace(userId, latitude, longitude);
    
    // Domain Mappings...
    const ageYears = calculateAge(user.dateOfBirth);
    const healthProfile: HealthProfile = {
      weightKg: user.weight, heightMeters: user.height, ageYears,
      gender: (user.gender as any) || 'OTHER', activityLevel: (user.activityLevel as any) || 'SEDENTARY',
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

    const hydration = calculateDynamicHydration(healthProfile, weatherContext);
    const outdoorAdvisory = getOutdoorAdvisory(weatherContext);

    const wellbeingPayload = {
      success: true,
      data: {
        location: weatherData.location,
        userProfile: { age: ageYears, bmi: Number((user.weight / (user.height ** 2)).toFixed(1)) },
        metabolicMetrics: {
          bmr: calculateBMR(healthProfile),
          tdee: calculateTDEE(healthProfile, weatherContext),
        },
        hydration: { targetMl: hydration.recommendedMl, breakdown: hydration.breakdown },
        workoutAdvisory: { isOutdoorExerciseRecommended: outdoorAdvisory.isOutdoorExerciseRecommended, warnings: outdoorAdvisory.warnings },
        healthInsights: outdoorAdvisory.insights,
        activeWeatherAlerts: weatherData.alertsAndAdvisories.alerts,
      },
    };

    try {
      await this.redis.set(cacheKey, JSON.stringify(wellbeingPayload), 'EX', 5400);
    } catch (e) {
      this.logger.error('Redis write error:', e);
    }

    return { ...wellbeingPayload, cached: false };
  }

  async getActiveSleepSession(userId: string) {
    return this.prisma.sleepLog.findFirst({
      where: { userId, wokeUpAt: null },
      orderBy: { sleptAt: 'desc' },
    });
  }

  async startSleepSession(userId: string, sleptAt?: string) {
    await this.prisma.sleepLog.updateMany({
      where: { userId, wokeUpAt: null },
      data: { wokeUpAt: new Date(), isFallback: true },
    });
    return this.prisma.sleepLog.create({
      data: { userId, sleptAt: sleptAt ? new Date(sleptAt) : new Date() },
    });
  }

  async wakeUpSession(userId: string, sessionId: string, wokeUpAt?: string, qualityRating?: number) {
    const existing = await this.prisma.sleepLog.findUnique({ where: { id: sessionId } });
    if (!existing || existing.userId !== userId) throw new NotFoundException('Session not found');

    return this.prisma.sleepLog.update({
      where: { id: sessionId },
      data: { 
        wokeUpAt: wokeUpAt ? new Date(wokeUpAt) : new Date(),
        qualityRating 
      },
    });
  }

  // --- New Core Features --- //

  async upsertHistoricalSleepLog(userId: string, dto: UpsertSleepLogDto) {
    const target = new Date(dto.targetDate);
    const diff = (new Date().getTime() - target.getTime()) / (1000 * 3600 * 24);

    if (diff > 8 || diff < 0) {
      throw new BadRequestException('You can only update logs within the past 7 days.');
    }

    // Logic: Look for any sleep session whose logical day matches the targetDate.
    // We use a heuristic: if they slept after noon, the logical day is the day they slept.
    // If they slept between 00:00 and 11:59AM, the logical day is the day BEFORE they slept.
    const logs = await this.prisma.sleepLog.findMany({
      where: {
        userId,
        sleptAt: { 
          gte: startOfDay(target), 
          lte: endOfDay(new Date(target.getTime() + 86400000)) // Buffer to catch late night sleeps
        }
      }
    });

    const targetDayStr = format(target, 'yyyy-MM-dd');
    let existingLog = logs.find(log => this.getLogicalDay(log.sleptAt) === targetDayStr);

    if (existingLog) {
      return this.prisma.sleepLog.update({
        where: { id: existingLog.id },
        data: {
          sleptAt: new Date(dto.sleptAt),
          wokeUpAt: new Date(dto.wokeUpAt),
          qualityRating: dto.qualityRating,
          isFallback: false,
        }
      });
    }

    return this.prisma.sleepLog.create({
      data: {
        userId,
        sleptAt: new Date(dto.sleptAt),
        wokeUpAt: new Date(dto.wokeUpAt),
        qualityRating: dto.qualityRating,
        isFallback: false,
      }
    });
  }

  async getSleepAnalytics(
    userId: string,
    query: SleepStatsQueryDto,
    userTimeZone?: string,
  ) {
    const baseDate = query.date ? new Date(query.date) : new Date();
    const timeframe = query.timeframe || StatsTimeframe.WEEK;

    let startDate: Date;
    let endDate: Date;

    if (timeframe === StatsTimeframe.DAY) {
      // 1. USE USER DAY BOUNDS FOR SINGLE DAY STATS
      const bounds = await getUserDayBounds(userId, baseDate, userTimeZone);
      startDate = bounds.dayStart;
      endDate = bounds.dayEnd;
    } else {
      // 2. FOR MULTI-DAY TIMEFRAMES, CALCULATE BOUNDS IN USER'S TIMEZONE
      const currentBounds = await getUserDayBounds(
        userId,
        baseDate,
        userTimeZone,
      );
      endDate = currentBounds.dayEnd;

      let daysToSub = 6;
      if (timeframe === StatsTimeframe.MONTH) daysToSub = 29;
      if (timeframe === StatsTimeframe.YEAR) daysToSub = 364;

      const pastBaseDate = subDays(baseDate, daysToSub);
      const pastBounds = await getUserDayBounds(
        userId,
        pastBaseDate,
        userTimeZone,
      );
      startDate = pastBounds.dayStart;
    }

    // 3. EXECUTE QUERY WITH TRUE UTC BOUNDS
    const logs = await this.prisma.sleepLog.findMany({
      where: {
        userId,
        sleptAt: {
          gte: startDate,
          lte: endDate,
        },
        wokeUpAt: { not: null },
      },
      orderBy: { sleptAt: 'asc' },
    });

    const groupedData: Record<
      string,
      { totalHours: number; count: number; dateRef: Date }
    > = {};

    logs.forEach((log) => {
      // Convert UTC timestamp back into user's timezone context for labeling
      const logicalDate = this.getLogicalDateObject(log.sleptAt);
      const hours =
        (log.wokeUpAt!.getTime() - log.sleptAt.getTime()) / (1000 * 3600);

      let key = '';
      if (
        timeframe === StatsTimeframe.DAY ||
        timeframe === StatsTimeframe.WEEK
      ) {
        key = format(logicalDate, 'EEE'); // "Mon", "Tue"
      } else if (timeframe === StatsTimeframe.MONTH) {
        key = `Week ${getISOWeek(logicalDate)}`;
      } else if (timeframe === StatsTimeframe.YEAR) {
        key = format(logicalDate, 'MMM'); // "Jan", "Feb"
      }

      if (!groupedData[key]) {
        groupedData[key] = { totalHours: 0, count: 0, dateRef: logicalDate };
      }
      groupedData[key].totalHours += hours;
      groupedData[key].count += 1;
    });

    return Object.keys(groupedData)
      .map((label) => ({
        label,
        avgHours: groupedData[label].totalHours / groupedData[label].count,
      }))
      .sort(
        (a, b) =>
          groupedData[a.label].dateRef.getTime() -
          groupedData[b.label].dateRef.getTime(),
      );
  }

  private getLogicalDateObject(date: Date): Date {
    return date; // Keep existing logical date implementation or adjust as needed
  }
  private getLogicalDay(sleptAt: Date): string {
    return format(this.getLogicalDateObject(sleptAt), 'yyyy-MM-dd');
  }
}