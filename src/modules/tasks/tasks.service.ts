import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateTaskDto } from './dto/create-task.dto';
import { PaginationDto, TaskStatusFilter } from 'src/common/dtos/pagination.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { Task } from '@prisma/client';

@Injectable()
export class TasksService {
  constructor(private readonly prisma: PrismaService) { }

  async create(userId: string, dto: CreateTaskDto) {
    await this.prisma.task.create({
      data: {
        userId,
        ...dto,
        dueDate: dto.dueDate ? new Date(dto.dueDate) : null,
      },
    });

    return {
      success: true,
      message: 'Task Created Successfully',
    };
  }

  async findAll(userId: string, pagination: PaginationDto) {
  const { cursor, limit = 10, search } = pagination;

  // 1. Force filter to ONLY pending (uncompleted) tasks
  const where: any = { 
    userId,
    isCompleted: false,
  };

  if (search) {
    where.OR = [
      { title: { contains: search, mode: 'insensitive' } },
      { category: { contains: search, mode: 'insensitive' } },
      { description: { contains: search, mode: 'insensitive' } },
    ];
  }

  // 2. Fetch pending DB Tasks
  const [totalTasks, dbTasks] = await Promise.all([
    this.prisma.task.count({ where }),
    this.prisma.task.findMany({
      where,
      take: limit + 1,
      cursor: cursor ? { id: cursor } : undefined,
      skip: cursor ? 1 : 0,
      orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
      select: {
        id: true,
        title: true,
        description: true,
        priority: true,
        energyRequired: true,
        isCompleted: true,
        isTopPriority: true,
        dueDate: true,
        category: true,
        tags: true,
        createdAt: true,
        habitId: true,
        habit: {
          select: {
            id: true,
            type: true,
            targetValue: true,
            unit: true,
            currentStreak: true,
            longestStreak: true,
            frequency: true,
          },
        },
      },
    }),
  ]);

  // 3. Fetch habits scheduled for today
  const todaysHabits = await this.getTodaysHabits(userId);

  // Set of habitIds that already have tasks in DB (pending)
  const existingHabitIds = new Set(
    dbTasks.filter((t) => t.habitId).map((t) => t.habitId),
  );

  // 4. Convert unscheduled habits into virtual task format (always uncompleted)
  const virtualHabitTasks = todaysHabits
    .filter((habit) => !existingHabitIds.has(habit.id))
    .map((habit) => ({
      id: `virtual-${habit.id}`,
      title: habit.title,
      description: null,
      priority: 'P3_MEDIUM',
      energyRequired: 'MEDIUM',
      isCompleted: false,
      isTopPriority: false,
      dueDate: new Date(),
      category: 'HABIT',
      tags: [],
      createdAt: habit.createdAt,
      habitId: habit.id,
      habit: {
        id: habit.id,
        type: habit.type,
        targetValue: habit.targetValue,
        unit: habit.unit,
        currentStreak: habit.currentStreak,
        longestStreak: habit.longestStreak,
        frequency: habit.frequency,
      },
    }));

  const combinedTasks = [...dbTasks, ...virtualHabitTasks];

  let nextCursor: string | undefined = undefined;
  if (combinedTasks.length > limit) {
    const nextItem = combinedTasks.pop();
    nextCursor = nextItem?.id;
  }

  return {
    success: true,
    data: combinedTasks,
    meta: {
      total: totalTasks + virtualHabitTasks.length,
      nextCursor,
      hasNextPage: !!nextCursor,
    },
  };
}

  private async getTodaysHabits(userId: string) {
    const days = [
      'SUNDAY',
      'MONDAY',
      'TUESDAY',
      'WEDNESDAY',
      'THURSDAY',
      'FRIDAY',
      'SATURDAY',
    ];
    const todayName = days[new Date().getDay()];

    return this.prisma.habit.findMany({
      where: {
        userId,
        OR: [
          { frequency: { has: 'DAILY' } },
          { frequency: { has: todayName } },
        ],
      },
    });
  }

  async getOne(userId: string, id: string) {
    const task = await this.prisma.task.findFirst({
      where: { id, userId },
    });

    if (!task) {
      throw new NotFoundException(
        'Task not found or you do not have permission to access it',
      );
    }

    return {
      success: true,
      task,
    };
  }

 async toggleComplete(userId: string, taskId: string): Promise<Task> {
  // 1. Completing a virtual habit task for the first time today
  if (taskId.startsWith('virtual-')) {
    const habitId = taskId.replace('virtual-', '');

    return this.prisma.$transaction(async (tx) => {
      const habit = await tx.habit.findFirst({
        where: { id: habitId, userId },
      });

      if (!habit) {
        throw new NotFoundException('Habit not found');
      }

      // Persist real task record as completed
      const newTask = await tx.task.create({
        data: {
          userId,
          habitId: habit.id,
          title: habit.title,
          category: 'HABIT',
          isCompleted: true,
          completedAt: new Date(),
          dueDate: new Date(),
        },
      });

      // Calculate streak updates
      const newCurrentStreak = habit.currentStreak + 1;
      const newLongestStreak = Math.max(habit.longestStreak, newCurrentStreak);

      await tx.habit.update({
        where: { id: habitId },
        data: {
          currentStreak: newCurrentStreak,
          longestStreak: newLongestStreak,
        },
      });

      return newTask;
    });
  }

  // 2. Standard task toggle logic (Handles regular tasks & existing persisted habit tasks)
  return this.prisma.$transaction(async (tx) => {
    const task = await tx.task.findFirst({
      where: { id: taskId, userId },
      select: { id: true, isCompleted: true, habitId: true },
    });

    if (!task) {
      throw new NotFoundException('Task not found');
    }

    const nextState = !task.isCompleted;

    const updatedTask = await tx.task.update({
      where: { id: taskId },
      data: {
        isCompleted: nextState,
        completedAt: nextState ? new Date() : null,
      },
    });

    // If this task belongs to a habit, update its streak stats
    if (task.habitId) {
      const habit = await tx.habit.findUnique({
        where: { id: task.habitId },
      });

      if (habit) {
        let newCurrentStreak = habit.currentStreak;

        if (nextState) {
          // Re-checking the task
          newCurrentStreak += 1;
        } else {
          // Unchecking the task (prevent negative streaks)
          newCurrentStreak = Math.max(0, habit.currentStreak - 1);
        }

        const newLongestStreak = Math.max(habit.longestStreak, newCurrentStreak);

        await tx.habit.update({
          where: { id: task.habitId },
          data: {
            currentStreak: newCurrentStreak,
            longestStreak: newLongestStreak,
          },
        });
      }
    }

    return updatedTask;
  });
}

  async update(userId: string, id: string, dto: UpdateTaskDto) {
    const task = await this.prisma.task.findFirst({
      where: { id, userId },
    });

    if (!task) {
      throw new NotFoundException('Task not found or access denied');
    }

    await this.prisma.task.update({
      where: { id },
      data: {
        ...dto,
        dueDate: dto.dueDate ? new Date(dto.dueDate) : undefined,
      },
    });

    return {
      success: true,
      message: 'Task updated successfully',
    };
  }

  async delete(userId: string, taskId: string) {
    const task = await this.prisma.task.findFirst({
      where: { id: taskId, userId },
      select: { id: true },
    });

    if (!task) {
      throw new NotFoundException('Task not found');
    }

    await this.prisma.task.delete({
      where: { id: taskId },
    });

    return {
      success: true,
      message: 'Task deleted successfully',
    };
  }
}