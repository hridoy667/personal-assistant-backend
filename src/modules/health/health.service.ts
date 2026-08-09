import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UpsertHealthLogDto } from './dto/health-log.dto';

@Injectable()
export class HealthService {
  constructor(private readonly prisma: PrismaService) {}

  async upsertLog(userId: string, dto: UpsertHealthLogDto) {
    const targetDate = dto.date ? new Date(dto.date) : new Date();
    targetDate.setUTCHours(0, 0, 0, 0);

    return this.prisma.healthLog.upsert({
      where: {
        userId_date: {
          userId,
          date: targetDate,
        },
      },
      update: {
        ...(dto.sleepHours !== undefined && { sleepHours: dto.sleepHours }),
        ...(dto.waterIntakeMl !== undefined && { waterIntakeMl: dto.waterIntakeMl }),
        ...(dto.weightKg !== undefined && { weightKg: dto.weightKg }),
        ...(dto.energyScore !== undefined && { energyScore: dto.energyScore }),
      },
      create: {
        userId,
        date: targetDate,
        sleepHours: dto.sleepHours,
        waterIntakeMl: dto.waterIntakeMl,
        weightKg: dto.weightKg,
        energyScore: dto.energyScore,
      },
    });
  }

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
}