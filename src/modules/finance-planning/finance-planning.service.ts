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
  const budgets = await this.prisma.budget.findMany({
    where: { userId, month, year },
    orderBy: { category: 'asc' },
  });

  // মাসের শুরু ও শেষ তারিখ নির্ধারণ
  const startDate = new Date(year, month - 1, 1);
  const endDate = new Date(year, month, 0, 23, 59, 59);

  // প্রতিটি বাজেটের জন্য খরচ হিসাব
  const budgetsWithSpent = await Promise.all(
    budgets.map(async (budget) => {
      const spentAggregation = await this.prisma.transaction.aggregate({
        where: {
          userId,
          category: { equals: budget.category, mode: 'insensitive' },
          isExpense: true,
          transactedAt: {
            gte: startDate,
            lte: endDate,
          },
        },
        _sum: { amount: true },
      });

      const spent = spentAggregation._sum.amount ? Number(spentAggregation._sum.amount) : 0;
      return {
        ...budget,
        spent,
        remaining: budget.limit - spent,
      };
    }),
  );

  return budgetsWithSpent;
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
  });

  if (!goal) {
    throw new NotFoundException('Savings goal not found');
  }

  return this.prisma.$transaction(async (tx) => {
    const updatedGoal = await tx.savingsGoal.update({
      where: { id: goalId },
      data: {
        currentAmount: { increment: dto.amount },
      },
    });

    await tx.transaction.create({
      data: {
        userId,
        amount: dto.amount,
        category: 'Savings',
        isExpense: true,
        description: `Deposit to savings goal: ${goal.title}`,
        transactedAt: new Date(),
      },
    });

    return updatedGoal;
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