import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateTaskDto } from './dto/create-task.dto';
import { PaginationDto,TaskStatusFilter } from 'src/common/dtos/pagination.dto';
import { UpdateTaskDto } from './dto/update-task.dto';

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
      message: "Task Created Successfully"
    }
  }

  async findAll(userId: string, pagination: PaginationDto) {
    const { cursor, limit = 10, search, status } = pagination;

    // 1. Build Dynamic Where Condition
    const where: any = { userId };

    // Status Filter (isCompleted check)
    if (status === TaskStatusFilter.PENDING) {
      where.isCompleted = false;
    } else if (status === TaskStatusFilter.COMPLETED) {
      where.isCompleted = true;
    }

    // Search Query Filter
    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { category: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ];
    }

    // 2. Execute parallel queries: Fetch Items + Total Count matching the current filter
    const [total, tasks] = await Promise.all([
      this.prisma.task.count({ where }),
      this.prisma.task.findMany({
        where,
        take: limit + 1, // Fetch 1 extra item to calculate next page cursor
        cursor: cursor ? { id: cursor } : undefined,
        skip: cursor ? 1 : 0,
        orderBy: [
          { createdAt: 'desc' }, // Stable cursor sorting strategy
          { id: 'asc' },
        ],
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
        },
      }),
    ]);

    // 3. Process Next Cursor
    let nextCursor: string | undefined = undefined;
    if (tasks.length > limit) {
      const nextItem = tasks.pop(); // Remove the extra item
      nextCursor = nextItem?.id;
    }

    return {
      success: true,
      data: tasks,
      meta: {
        total, // Total count matching the filters
        nextCursor,
        hasNextPage: !!nextCursor,
      },
    };
  }

  async getOne(userId: string, id: string) {
    const task = await this.prisma.task.findFirst({
      where: {
        id,
        userId,
      },
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

  async toggleComplete(userId: string, taskId: string) {
    const task = await this.prisma.task.findFirst({
      where: { id: taskId, userId },
      select: { id: true, isCompleted: true },
    });

    if (!task) {
      throw new NotFoundException('Task not found');
    }

    const isCompleted = !task.isCompleted;
    return this.prisma.task.update({
      where: { id: taskId },
      data: {
        isCompleted,
        completedAt: isCompleted ? new Date() : null,
      },
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
      message: "Task updated successfully"
    }

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
      message: "Task deleted successfully"
    }
  }
}