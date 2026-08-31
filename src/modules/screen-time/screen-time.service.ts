import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { BatchSyncScreenTimeDto } from './dto/screen-time.dto';
import { InjectRedis } from '@nestjs-modules/ioredis';
import Redis from 'ioredis';
import { getUserDayBounds } from 'src/common/utils/day-bounds.util';
import { AppCategory } from '@prisma/client';

@Injectable()
export class ScreenTimeService {
  constructor(
    private readonly prisma: PrismaService,
    @InjectRedis() private readonly redis: Redis,
  ) {}

  private sanitizeAppName(packageName?: string, appName?: string): string {
    const KNOWN_PACKAGES: Record<string, string> = {
      'com.facebook.katana': 'Facebook',
      'com.facebook.orca': 'Facebook Messenger',
      'com.katana': 'Katana',
      'com.joinblocks': 'Join Blocks',
      'host.exp.exponent': 'Expo Go',
      'com.google.android.youtube': 'YouTube',
      'com.instagram.android': 'Instagram',
      'com.whatsapp': 'WhatsApp',
    };

    if (packageName && KNOWN_PACKAGES[packageName]) {
      return KNOWN_PACKAGES[packageName];
    }

    if (appName && appName !== packageName) {
      return appName.charAt(0).toUpperCase() + appName.slice(1);
    }

    if (packageName) {
      const segment = packageName.split('.').pop() || packageName;
      return segment.charAt(0).toUpperCase() + segment.slice(1);
    }

    return 'Unknown App';
  }

  async syncScreenTime(userId: string, dto: BatchSyncScreenTimeDto) {
    const requestDate = dto.date ? new Date(dto.date) : new Date();

    // 1. Get user's logical day bounds for day-alignment
    const bounds = await getUserDayBounds(userId, requestDate);
    const syncDate = bounds.logicalDate;

    // 2. Upsert total screen time log for the logical date
    await this.prisma.screenTimeLog.upsert({
      where: {
        userId_date: {
          userId,
          date: syncDate,
        },
      },
      update: {
        totalScreenTimeMins: dto.totalScreenTimeMins,
        productivityScore: dto.productivityScore,
        deviceOs: dto.deviceOs,
      },
      create: {
        userId,
        date: syncDate,
        totalScreenTimeMins: dto.totalScreenTimeMins,
        productivityScore: dto.productivityScore,
        deviceOs: dto.deviceOs,
      },
    });

    // 3. Process and aggregate app usages by appName
    if (dto.appUsages && dto.appUsages.length > 0) {
      const aggregatedMap = new Map<
        string,
        { packageName: string; category: AppCategory; timeSpentMins: number }
      >();

      for (const usage of dto.appUsages) {
        const cleanAppName = this.sanitizeAppName(usage.packageName, usage.appName);
        const existing = aggregatedMap.get(cleanAppName);

        if (existing) {
          existing.timeSpentMins += usage.timeSpentMins;
        } else {
          aggregatedMap.set(cleanAppName, {
            packageName: usage.packageName || '',
            category: usage.category || AppCategory.NEUTRAL,
            timeSpentMins: usage.timeSpentMins,
          });
        }
      }

      // 4. Clear existing app usage entries for this user & logical date to prevent duplicates
      await this.prisma.appUsage.deleteMany({
        where: {
          userId,
          date: syncDate,
        },
      });

      // 5. Insert clean, aggregated app usage list
      const insertData = Array.from(aggregatedMap.entries()).map(
        ([appName, data]) => ({
          userId,
          date: syncDate,
          appName,
          packageName: data.packageName,
          category: data.category,
          timeSpentMins: data.timeSpentMins,
        }),
      );

      await this.prisma.appUsage.createMany({
        data: insertData,
      });
    }

    return { success: true };
  }

  async getDailySummary(userId: string, requestDateStr?: string) {
    const requestDate = requestDateStr ? new Date(requestDateStr) : new Date();

    // 1. Get exact logical bounds for this user
    const bounds = await getUserDayBounds(userId, requestDate);

    // 2. Query total screen time log matching the logical date
    const summary = await this.prisma.screenTimeLog.findFirst({
      where: {
        userId,
        date: bounds.logicalDate,
      },
    });

    // 3. Query aggregated app usages logged for the logical date
    const appUsages = await this.prisma.appUsage.findMany({
      where: {
        userId,
        date: bounds.logicalDate,
      },
      select: {
        packageName: true,
        appName: true,
        category: true,
        timeSpentMins: true,
      },
      orderBy: { timeSpentMins: 'desc' },
    });

    return {
      summary: summary || { totalScreenTimeMins: 0, productivityScore: null },
      appUsages,
      bounds: {
        dayStart: bounds.dayStart,
        dayEnd: bounds.dayEnd,
      },
    };
  }
}