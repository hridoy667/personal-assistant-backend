import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateTaskDto } from './dto/create-task.dto';
import { PaginationDto } from 'src/common/dtos/pagination.dto';
import { UpdateTaskDto } from './dto/update-task.dto';

@Injectable()
export class TasksService {
  constructor(private readonly prisma: PrismaService) {}

  async create(userId: string, dto: CreateTaskDto) {
    await this.prisma.task.create({
      data: {
        userId,
        ...dto,
        dueDate: dto.dueDate ? new Date(dto.dueDate) : null,
      },
    });
    return {
      success:true,
      message:"Task Created Successfully"
    }
  }

  async findAll(userId: string, pagination: PaginationDto) {
    const { cursor, limit = 4, search } = pagination;

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
      orderBy: [
        { dueDate: 'asc' },   // 1. Sort by Date first (earliest due date first)
        { priority: 'asc' },  // 2. Sort by Priority second (P1_URGENT -> P2_HIGH -> P3_MEDIUM -> P4_LOW)
        { id: 'asc' },        // 3. Tie-breaker for stable cursor-based pagination
      ],
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
      success: true,
      data: tasks,
      meta: {
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

    return{
      success:true,
      message:"Task updated successfully"
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
    return{
      success:true,
      message:"Task deleted successfully"
    }
  }
}