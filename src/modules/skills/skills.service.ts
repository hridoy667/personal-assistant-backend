import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { GenerateSkillRoadmapDto, LogSkillTimeDto } from './dto/skill.dto';
import { UpdateSkillDto } from './dto/update-skill.dto';
import { SkillsAiService } from './skills-ai.service'

@Injectable()
export class SkillsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly aiService: SkillsAiService,
  ) {}

  /**
   * Create skill and generate AI roadmap with Theory + Timestamped Video + Practice
   */
  async generateSkillWithRoadmap(userId: string, dto: GenerateSkillRoadmapDto) {
    const generatedModules = await this.aiService.generateRoadmap(
      dto.title,
      dto.level,
      dto.resources,
    );

    return this.prisma.skill.create({
      data: {
        userId,
        title: dto.title,
        targetHours: dto.targetHours,
        level: dto.level,
        modules: {
          create: generatedModules.map((mod: any, index: number) => ({
            title: mod.title,
            order: index + 1,
            theoryText: mod.theoryText,
            videoUrl: mod.videoUrl,
            practiceTask: mod.practiceTask,
          })),
        },
      },
      include: {
        modules: {
          orderBy: { order: 'asc' },
        },
      },
    });
  }

  /**
   * List all skills for a user
   */
  async findAll(userId: string) {
    return this.prisma.skill.findMany({
      where: { userId },
      orderBy: { updatedAt: 'desc' },
      include: {
        _count: {
          select: { modules: true },
        },
      },
    });
  }

  /**
   * Get single skill with full module roadmap
   */
  async findOne(userId: string, id: string) {
    const skill = await this.prisma.skill.findFirst({
      where: { id, userId },
      include: {
        modules: {
          orderBy: { order: 'asc' },
        },
      },
    });

    if (!skill) {
      throw new NotFoundException('Skill not found or access denied');
    }

    return skill;
  }

  /**
   * Update skill title, target hours, or level
   */
  async update(userId: string, id: string, dto: UpdateSkillDto) {
    const skill = await this.prisma.skill.findFirst({
      where: { id, userId },
      select: { id: true },
    });

    if (!skill) {
      throw new NotFoundException('Skill record not found or access denied');
    }

    return this.prisma.skill.update({
      where: { id },
      data: { ...dto },
      include: {
        modules: { orderBy: { order: 'asc' } },
      },
    });
  }

  /**
   * Increment logged practice time
   */
  async logHours(userId: string, skillId: string, dto: LogSkillTimeDto) {
    const skill = await this.prisma.skill.findFirst({
      where: { id: skillId, userId },
      select: { id: true },
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

  /**
   * Toggle completion status of a module inside a skill
   */
  async toggleModuleComplete(userId: string, moduleId: string) {
    const module = await this.prisma.skillModule.findFirst({
      where: { id: moduleId, skill: { userId } },
    });

    if (!module) {
      throw new NotFoundException('Module not found or access denied');
    }

    return this.prisma.skillModule.update({
      where: { id: moduleId },
      data: { isCompleted: !module.isCompleted },
    });
  }

  /**
   * Delete a skill (Cascade deletes associated modules)
   */
  async delete(userId: string, id: string) {
    const skill = await this.prisma.skill.findFirst({
      where: { id, userId },
      select: { id: true },
    });

    if (!skill) {
      throw new NotFoundException('Skill not found or access denied');
    }

    await this.prisma.skill.delete({
      where: { id },
    });

    return {
      success: true,
      message: 'Skill deleted successfully',
    };
  }
}