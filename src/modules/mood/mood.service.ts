import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateMoodLogDto } from './dto/create-mood.dto';
import { UpdateMoodDto } from './dto/update-mood.dto';
import { getUserDayBounds } from 'src/common/utils/day-bounds.util';

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

  async getDailyLogs(userId: string, userTimeZone?: string) {
    // 1. Fetch user's logical day boundaries
    const { dayStart, dayEnd } = await getUserDayBounds(
      userId,
      new Date(),
      userTimeZone,
    );

    // 2. Query mood logs strictly within their active waking cycle
    return this.prisma.moodLog.findMany({
      where: {
        userId,
        createdAt: {
          gte: dayStart,
          lte: dayEnd,
        },
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  async update(userId: string, id: string, dto: UpdateMoodDto) {
    const moodLog = await this.prisma.moodLog.findFirst({
      where: { id, userId },
    });

    if (!moodLog) {
      throw new NotFoundException('Mood entry not found or access denied');
    }

    return this.prisma.moodLog.update({
      where: { id },
      data: {
        ...dto,
      },
    });
  }

}