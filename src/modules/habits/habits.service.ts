import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateHabitDto } from './dto/create-habit.dto';
import { UpdateHabitDto } from './dto/update-habit.dto';

@Injectable()
export class HabitsService {
  constructor(private readonly prisma: PrismaService) { }

  async create(userId: string, dto: CreateHabitDto) {
    // Pure Habit creation: tasks are rendered dynamically in TasksService.findAll
    return this.prisma.habit.create({
      data: {
        userId,
        title: dto.title,
        type: dto.type,
        targetValue: dto.targetValue,
        unit: dto.unit,
        frequency: dto.frequency,
      },
    });
  }
  
  async getStreaks(userId: string, id: string) {
    const habit = await this.prisma.habit.findFirst({
      where: { id, userId },
      select: {
        id: true,
        title: true,
        currentStreak: true,
        longestStreak: true,
        createdAt: true,
        // Automatically count all linked tasks that are completed
        _count: {
          select: {
            tasks: { where: { isCompleted: true } }
          }
        },
      },
    });

    if (!habit) {
      throw new NotFoundException('Habit not found or access denied');
    }

    return {
      success: true,
      data: {
        currentStreak: habit.currentStreak,
        longestStreak: habit.longestStreak,
        totalCompletions: habit._count.tasks,
        startDate: habit.createdAt,
      },
    };
  }

  async findAll(userId: string) {
    return this.prisma.habit.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      include: {
        tasks: {
          take: 7,
          orderBy: { createdAt: 'desc' },
        },
      },
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
      data: { ...dto },
    });
  }

  async deleteHabit(userId: string, id: string) {
    const habit = await this.prisma.habit.findFirst({
      where: { id, userId },
      select: { id: true },
    });

    if (!habit) {
      throw new NotFoundException('Habit not found or access denied');
    }

    await this.prisma.habit.delete({
      where: { id },
    });

    return {
      success: true,
      message: 'Habit deleted successfully',
    };
  }
}