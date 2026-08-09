import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateSkillDto, LogSkillTimeDto } from './dto/skill.dto';
import { UpdateSkillDto } from './dto/update-skill.dto';

@Injectable()
export class SkillsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(userId: string, dto: CreateSkillDto) {
    return this.prisma.skill.create({
      data: {
        userId,
        ...dto,
      },
    });
  }

  async findAll(userId: string) {
    return this.prisma.skill.findMany({
      where: { userId },
      orderBy: { updatedAt: 'desc' },
    });
  }

  async logHours(userId: string, skillId: string, dto: LogSkillTimeDto) {
    const skill = await this.prisma.skill.findFirst({
      where: { id: skillId, userId },
      select: { id: true, loggedHours: true },
    });

    if (!skill) {
      throw new NotFoundException('Skill not found');
    }

    return this.prisma.skill.update({
      where: { id: skillId },
      data: {
        loggedHours: {
          increment: dto.hours,
        },
      },
    });
  }

  async delete(userId: string, skillId: string) {
    const skill = await this.prisma.skill.findFirst({
      where: { id: skillId, userId },
      select: { id: true },
    });

    if (!skill) {
      throw new NotFoundException('Skill not found');
    }

    return this.prisma.skill.delete({
      where: { id: skillId },
    });
  }

  async update(userId: string, id: string, dto: UpdateSkillDto) {
    const skill = await this.prisma.skill.findFirst({
      where: { id, userId },
    });

    if (!skill) {
      throw new NotFoundException('Skill record not found or access denied');
    }

    return this.prisma.skill.update({
      where: { id },
      data: {
        ...dto,
      },
    });
  }
}