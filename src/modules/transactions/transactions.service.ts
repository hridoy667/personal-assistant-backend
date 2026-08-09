import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateTransactionDto } from './dto/create-transaction.dto';
import { PaginationDto } from 'src/common/dtos/pagination.dto';
import { UpdateTransactionDto } from './dto/update-transaction.dto';

@Injectable()
export class TransactionsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(userId: string, dto: CreateTransactionDto) {
    return this.prisma.transaction.create({
      data: {
        userId,
        ...dto,
        transactedAt: dto.transactedAt ? new Date(dto.transactedAt) : new Date(),
      },
    });
  }

  async findAll(userId: string, pagination: PaginationDto) {
    const { cursor, limit = 10, search } = pagination;

    const where: any = { userId };
    if (search) {
      where.OR = [
        { category: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ];
    }

    const transactions = await this.prisma.transaction.findMany({
      where,
      take: limit + 1,
      cursor: cursor ? { id: cursor } : undefined,
      skip: cursor ? 1 : 0,
      orderBy: { transactedAt: 'desc' },
      select: {
        id: true,
        amount: true,
        category: true,
        isExpense: true,
        description: true,
        isRecurring: true,
        transactedAt: true,
      },
    });

    let nextCursor: string | undefined = undefined;
    if (transactions.length > limit) {
      const nextItem = transactions.pop();
      nextCursor = nextItem?.id;
    }

    return {
      data: transactions,
      meta: {
        nextCursor,
        hasNextPage: !!nextCursor,
      },
    };
  }

  async update(userId: string, id: string, dto: UpdateTransactionDto) {
    const transaction = await this.prisma.transaction.findFirst({
      where: { id, userId },
    });

    if (!transaction) {
      throw new NotFoundException('Transaction record not found or access denied');
    }

    return this.prisma.transaction.update({
      where: { id },
      data: {
        ...dto,
        transactedAt: dto.transactedAt ? new Date(dto.transactedAt) : undefined,
      },
    });
  }

  async delete(userId: string, transactionId: string) {
    const transaction = await this.prisma.transaction.findFirst({
      where: { id: transactionId, userId },
      select: { id: true },
    });

    if (!transaction) {
      throw new NotFoundException('Transaction not found');
    }

    return this.prisma.transaction.delete({
      where: { id: transactionId },
    });
  }
}