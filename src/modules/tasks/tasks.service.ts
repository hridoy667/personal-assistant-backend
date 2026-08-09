import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateTaskDto } from './dto/create-task.dto';
import { PaginationDto } from 'src/common/dtos/pagination.dto';

@Injectable()
export class TasksService {
  constructor(private readonly prisma: PrismaService) {}

  async create(userId: string, dto: CreateTaskDto) {
    return this.prisma.task.create({
      data: {
        userId,
        ...dto,
        dueDate: dto.dueDate ? new Date(dto.dueDate) : null,
      },
    });
  }

  async findAll(userId: string, pagination: PaginationDto) {
    const { cursor, limit = 10, search } = pagination;

    const where: any = { userId };
    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { category: { contains: search, mode: 'insensitive' } },
      ];
    }

    const tasks = await this.prisma.task.findMany({
      where,
      take: limit + 1, // Fetch 1 extra item to check for next page
      cursor: cursor ? { id: cursor } : undefined,
      skip: cursor ? 1 : 0,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        title: true,
        priority: true,
        energyRequired: true,
        isCompleted: true,
        isTopPriority: true,
        dueDate: true,
        category: true,
        tags: true,
        createdAt: true,
      },
    });

    let nextCursor: string | undefined = undefined;
    if (tasks.length > limit) {
      const nextItem = tasks.pop();
      nextCursor = nextItem?.id;
    }

    return {
      data: tasks,
      meta: {
        nextCursor,
        hasNextPage: !!nextCursor,
      },
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

  async delete(userId: string, taskId: string) {
    const task = await this.prisma.task.findFirst({
      where: { id: taskId, userId },
      select: { id: true },
    });

    if (!task) {
      throw new NotFoundException('Task not found');
    }

    return this.prisma.task.delete({
      where: { id: taskId },
    });
  }
}