import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateRoutineDto, UpdateRoutineDto } from './dto/routine.dto';

@Injectable()
export class RoutinesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(userId: string, dto: CreateRoutineDto) {
    return this.prisma.routine.create({
      data: {
        userId,
        title: dto.title,
        type: dto.type,
        steps: dto.steps as any,
        isActive: dto.isActive ?? true,
      },
    });
  }

  async findAll(userId: string) {
    return this.prisma.routine.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(userId: string, routineId: string) {
    const routine = await this.prisma.routine.findFirst({
      where: { id: routineId, userId },
    });

    if (!routine) {
      throw new NotFoundException('Routine not found');
    }

    return routine;
  }

  async update(userId: string, routineId: string, dto: UpdateRoutineDto) {
    await this.findOne(userId, routineId);

    const updateData: any = {};
    if (dto.title) updateData.title = dto.title;
    if (dto.type) updateData.type = dto.type;
    if (dto.steps) updateData.steps = dto.steps;
    if (dto.isActive !== undefined) updateData.isActive = dto.isActive;

    return this.prisma.routine.update({
      where: { id: routineId },
      data: updateData,
    });
  }

  async delete(userId: string, routineId: string) {
    await this.findOne(userId, routineId);

    return this.prisma.routine.delete({
      where: { id: routineId },
    });
  }
}