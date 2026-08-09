import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { BatchSyncScreenTimeDto } from './dto/screen-time.dto';
import { InjectRedis } from '@nestjs-modules/ioredis';
import Redis from 'ioredis';

@Injectable()
export class ScreenTimeService {
  constructor(
    private readonly prisma: PrismaService,
    @InjectRedis() private readonly redis: Redis,
  ) {}

  async syncScreenTime(userId: string, dto: BatchSyncScreenTimeDto) {
    const targetDate = dto.date ? new Date(dto.date) : new Date();
    targetDate.setUTCHours(0, 0, 0, 0);

    const dateStr = targetDate.toISOString().split('T')[0];
    const cacheKey = `screentime:${userId}:${dateStr}`;
    const deviceOs = dto.deviceOs ?? 'ANDROID';

    const result = await this.prisma.$transaction(async (tx) => {
      // 1. Upsert total screen time log
      const screenTimeLog = await tx.screenTimeLog.upsert({
        where: {
          userId_date: {
            userId,
            date: targetDate,
          },
        },
        update: {
          totalScreenTimeMins: dto.totalScreenTimeMins,
          productivityScore: dto.productivityScore,
          deviceOs: deviceOs as any,
        },
        create: {
          userId,
          date: targetDate,
          totalScreenTimeMins: dto.totalScreenTimeMins,
          productivityScore: dto.productivityScore,
          deviceOs: deviceOs as any,
        },
      });

      // 2. Delete existing app usages for re-sync safety
      await tx.appUsage.deleteMany({
        where: {
          userId,
          date: targetDate,
        },
      });

      // 3. Insert app/category usages if present
      if (dto.appUsages && dto.appUsages.length > 0) {
        await tx.appUsage.createMany({
          data: dto.appUsages.map((app) => ({
            userId,
            packageName: app.packageName ?? null,
            // Fallback for iOS category-level sync
            appName: app.appName ?? app.category ?? 'Uncategorized',
            category: app.category ?? 'NEUTRAL',
            timeSpentMins: app.timeSpentMins,
            date: targetDate,
          })),
        });
      }

      return screenTimeLog;
    });

    // Cache summary metrics in Redis with 1-hour TTL
    await this.redis.setex(
      cacheKey,
      3600,
      JSON.stringify({
        totalMins: dto.totalScreenTimeMins,
        productivityScore: dto.productivityScore,
        deviceOs,
      }),
    );

    return result;
  }

  async getDailySummary(userId: string, dateStr?: string) {
    const targetDate = dateStr ? new Date(dateStr) : new Date();
    targetDate.setUTCHours(0, 0, 0, 0);

    const formattedDate = targetDate.toISOString().split('T')[0];
    const cacheKey = `screentime:${userId}:${formattedDate}`;

    const cached = await this.redis.get(cacheKey);
    const cachedStats = cached ? JSON.parse(cached) : null;

    const screenTime = await this.prisma.screenTimeLog.findUnique({
      where: {
        userId_date: {
          userId,
          date: targetDate,
        },
      },
    });

    const appUsages = await this.prisma.appUsage.findMany({
      where: {
        userId,
        date: targetDate,
      },
      orderBy: { timeSpentMins: 'desc' },
    });

    return {
      date: targetDate,
      summary: screenTime ?? cachedStats ?? {
        totalScreenTimeMins: 0,
        productivityScore: null,
        deviceOs: 'ANDROID',
      },
      appUsages,
    };
  }
}