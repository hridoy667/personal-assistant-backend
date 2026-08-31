import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UpsertSleepLogDto, SleepStatsQueryDto, StatsTimeframe } from './dto/health-log.dto';
import { calculateAge } from 'src/common/utils/date-helper.util';
import { calculateBMR, calculateDynamicHydration, calculateTDEE, getOutdoorAdvisory, HealthProfile, WeatherContext } from 'src/common/utils/health-science.util';
import { DashboardService } from '../dashbord/dashboard.service';
import { InjectRedis } from '@nestjs-modules/ioredis';
import Redis from 'ioredis';
import { startOfDay, endOfDay, subDays, format, getISOWeek, addDays } from 'date-fns';
import { getUserDayBounds } from 'src/common/utils/day-bounds.util';
import { toZonedTime, fromZonedTime } from 'date-fns-tz';

@Injectable()
export class HealthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly dashboardService: DashboardService,
    @InjectRedis() private readonly redis: Redis,
  ) { }

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

  async getWellbeingContext(userId: string) {
  const user = await this.prisma.user.findUnique({
    where: { id: userId },
    select: {
      height: true,
      weight: true,
      dateOfBirth: true,
      gender: true,
      activityLevel: true,
      latitude: true,
      longitude: true,
      district: true,
      location: true,
    },
  });

  if (!user || !user.height || !user.weight || !user.dateOfBirth) {
    return { success: false, message: 'Please update your profile.', isUpdateRequired: true };
  }

  // Parse user stored coordinates
  const lat = user.latitude !== null && user.latitude !== undefined ? Number(user.latitude) : undefined;
  const lon = user.longitude !== null && user.longitude !== undefined ? Number(user.longitude) : undefined;

  // Build Redis cache key based on coordinates or location fallback
  let locationKeySegment = 'default';
  if (lat !== undefined && lon !== undefined) {
    locationKeySegment = `coords:${lat.toFixed(2)}:${lon.toFixed(2)}`;
  } else if (user.district) {
    locationKeySegment = `district:${user.district.trim().toLowerCase()}`;
  } else if (user.location) {
    locationKeySegment = `loc:${user.location.trim().toLowerCase()}`;
  }

  const cacheKey = `wellbeing:user:${userId}:${locationKeySegment}`;

  try {
    const cachedData = await this.redis.get(cacheKey);
    if (cachedData) return { ...JSON.parse(cachedData), cached: true };
  } catch (e) {
    this.logger.error('Redis read error:', e);
  }

  // Fetch weather data using user coordinates
  const weatherData = await this.dashboardService.getWeatherByPlace(userId, lat, lon);

  // Domain Mappings...
  const ageYears = calculateAge(user.dateOfBirth);
  const healthProfile: HealthProfile = {
    weightKg: user.weight,
    heightMeters: user.height,
    ageYears,
    gender: (user.gender as any) || 'OTHER',
    activityLevel: (user.activityLevel as any) || 'SEDENTARY',
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
      userProfile: {
        age: ageYears,
        bmi: Number((user.weight / user.height ** 2).toFixed(1)),
      },
      metabolicMetrics: {
        bmr: calculateBMR(healthProfile),
        tdee: calculateTDEE(healthProfile, weatherContext),
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

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { defaultWakeTime: true, defaultSleepTime: true, timezone: true },
    });

    const tz = userTimeZone || user?.timezone || 'UTC';
    const [wakeH, wakeM] = (user?.defaultWakeTime || '06:00').split(':').map(Number);

    let startDate: Date;
    let endDate: Date;

    if (timeframe === StatsTimeframe.DAY) {
      const bounds = await getUserDayBounds(userId, baseDate, tz);
      // Expand query range slightly (sub 24h) so late-night/evening sleeps are included
      startDate = subDays(bounds.dayStart, 1);
      endDate = addDays(bounds.dayEnd, 1);
    } else {
      let daysToSub = 6;
      if (timeframe === StatsTimeframe.MONTH) daysToSub = 29;
      if (timeframe === StatsTimeframe.YEAR) daysToSub = 364;

      const currentBounds = await getUserDayBounds(userId, baseDate, tz);
      endDate = addDays(currentBounds.dayEnd, 1);

      const pastBaseDate = subDays(baseDate, daysToSub);
      const pastBounds = await getUserDayBounds(userId, pastBaseDate, tz);
      startDate = subDays(pastBounds.dayStart, 1);
    }

    // Fetch sleep records within calculated window
    const logs = await this.prisma.sleepLog.findMany({
      where: {
        userId,
        sleptAt: {
          gte: startDate,
          lte: endDate,
        },
      },
      orderBy: { sleptAt: 'asc' },
    });

    const groupedData: Record<
      string,
      { totalHours: number; count: number; dateRef: Date }
    > = {};

    logs.forEach((log) => {
      const effectiveSleptAt = log.sleptAt;
      let effectiveWokeUpAt: Date;

      if (log.wokeUpAt) {
        effectiveWokeUpAt = log.wokeUpAt;
      } else {
        const zonedSleptAt = toZonedTime(log.sleptAt, tz);
        const defaultWakeZoned = new Date(zonedSleptAt);
        defaultWakeZoned.setHours(wakeH, wakeM, 0, 0);

        if (defaultWakeZoned <= zonedSleptAt) {
          defaultWakeZoned.setDate(defaultWakeZoned.getDate() + 1);
        }
        effectiveWokeUpAt = fromZonedTime(defaultWakeZoned, tz);
      }

      const hours =
        (effectiveWokeUpAt.getTime() - effectiveSleptAt.getTime()) / (1000 * 3600);

      const logicalDate = effectiveSleptAt;

      let key = '';
      if (
        timeframe === StatsTimeframe.DAY ||
        timeframe === StatsTimeframe.WEEK
      ) {
        key = format(toZonedTime(logicalDate, tz), 'EEE');
      } else if (timeframe === StatsTimeframe.MONTH) {
        key = `Week ${getISOWeek(toZonedTime(logicalDate, tz))}`;
      } else if (timeframe === StatsTimeframe.YEAR) {
        key = format(toZonedTime(logicalDate, tz), 'MMM');
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
        avgHours: Number((groupedData[label].totalHours / groupedData[label].count).toFixed(2)),
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