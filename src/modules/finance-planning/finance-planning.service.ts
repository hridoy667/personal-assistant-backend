import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateBudgetDto,
  CreateSavingsGoalDto,
  DepositSavingsDto,
} from './dto/finance-planning.dto';
import { UpdateBudgetDto, UpdateSavingsGoalDto } from './dto/update-finance-planning.dto';

@Injectable()
export class FinancePlanningService {
  constructor(private readonly prisma: PrismaService) {}

  // ==================== BUDGETS ====================

  async createBudget(userId: string, dto: CreateBudgetDto) {
    return this.prisma.budget.create({
      data: {
        userId,
        ...dto,
      },
    });
  }

  async getBudgets(userId: string, month: number, year: number) {
    return this.prisma.budget.findMany({
      where: {
        userId,
        month,
        year,
      },
      orderBy: { category: 'asc' },
    });
  }

  async deleteBudget(userId: string, budgetId: string) {
    const budget = await this.prisma.budget.findFirst({
      where: { id: budgetId, userId },
      select: { id: true },
    });

    if (!budget) {
      throw new NotFoundException('Budget limit not found');
    }

    return this.prisma.budget.delete({
      where: { id: budgetId },
    });
  }

  // ==================== SAVINGS GOALS ====================

  async createSavingsGoal(userId: string, dto: CreateSavingsGoalDto) {
    return this.prisma.savingsGoal.create({
      data: {
        userId,
        title: dto.title,
        targetAmount: dto.targetAmount,
        currentAmount: dto.currentAmount ?? 0,
        targetDate: dto.targetDate ? new Date(dto.targetDate) : null,
      },
    });
  }

  async getSavingsGoals(userId: string) {
    return this.prisma.savingsGoal.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async depositToSavings(
    userId: string,
    goalId: string,
    dto: DepositSavingsDto,
  ) {
    const goal = await this.prisma.savingsGoal.findFirst({
      where: { id: goalId, userId },
      select: { id: true },
    });

    if (!goal) {
      throw new NotFoundException('Savings goal not found');
    }

    return this.prisma.savingsGoal.update({
      where: { id: goalId },
      data: {
        currentAmount: {
          increment: dto.amount,
        },
      },
    });
  }

  async deleteSavingsGoal(userId: string, goalId: string) {
    const goal = await this.prisma.savingsGoal.findFirst({
      where: { id: goalId, userId },
      select: { id: true },
    });

    if (!goal) {
      throw new NotFoundException('Savings goal not found');
    }

    return this.prisma.savingsGoal.delete({
      where: { id: goalId },
    });
  }

  async updateBudget(userId: string, id: string, dto: UpdateBudgetDto) {
    const budget = await this.prisma.budget.findFirst({
      where: { id, userId },
    });

    if (!budget) {
      throw new NotFoundException('Budget record not found or access denied');
    }

    return this.prisma.budget.update({
      where: { id },
      data: { ...dto },
    });
  }

  async updateSavingsGoal(userId: string, id: string, dto: UpdateSavingsGoalDto) {
    const goal = await this.prisma.savingsGoal.findFirst({
      where: { id, userId },
    });

    if (!goal) {
      throw new NotFoundException('Savings goal not found or access denied');
    }

    return this.prisma.savingsGoal.update({
      where: { id },
      data: {
        ...dto,
        targetDate: dto.targetDate ? new Date(dto.targetDate) : undefined,
      },
    });
  }

}