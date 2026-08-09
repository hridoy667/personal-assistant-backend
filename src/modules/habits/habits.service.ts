import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateHabitDto, LogHabitDto } from './dto/create-habit.dto';
import { UpdateHabitDto } from './dto/update-habit.dto';

@Injectable()
export class HabitsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(userId: string, dto: CreateHabitDto) {
    return this.prisma.habit.create({
      data: {
        userId,
        ...dto,
      },
    });
  }

  async findAll(userId: string) {
    return this.prisma.habit.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      include: {
        logs: {
          take: 7, // Return recent 7 logs for UI streak bars
          orderBy: { loggedAt: 'desc' },
        },
      },
    });
  }

  async logProgress(userId: string, habitId: string, dto: LogHabitDto) {
    const habit = await this.prisma.habit.findFirst({
      where: { id: habitId, userId },
    });

    if (!habit) {
      throw new NotFoundException('Habit not found');
    }

    // Atomic transaction to log entry and increment streaks safely
    return this.prisma.$transaction(async (tx) => {
      const log = await tx.habitLog.create({
        data: {
          habitId,
          value: dto.value ?? 1,
        },
      });

      const updatedStreak = habit.currentStreak + 1;
      const longestStreak = Math.max(updatedStreak, habit.longestStreak);

      const updatedHabit = await tx.habit.update({
        where: { id: habitId },
        data: {
          currentStreak: updatedStreak,
          longestStreak,
        },
      });

      return { log, habit: updatedHabit };
    });
  }

  async update(userId: string, id: string, dto: UpdateHabitDto) {
    const habit = await this.prisma.habit.findFirst({
      where: { id, userId },
    });

    if (!habit) {
      throw new NotFoundException('Habit not found or access denied');
    }

    return this.prisma.habit.update({
      where: { id },
      data: {
        ...dto,
      },
    });
  }
}