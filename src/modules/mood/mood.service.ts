import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateMoodLogDto } from './dto/create-mood.dto';

@Injectable()
export class MoodService {
  constructor(private readonly prisma: PrismaService) {}

  async create(userId: string, dto: CreateMoodLogDto) {
    return this.prisma.moodLog.create({
      data: {
        userId,
        ...dto,
      },
    });
  }

  async getDailyLogs(userId: string) {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    return this.prisma.moodLog.findMany({
      where: {
        userId,
        createdAt: {
          gte: startOfDay,
        },
      },
      orderBy: { createdAt: 'asc' },
    });
  }
}