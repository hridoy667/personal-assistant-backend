import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateJournalDto } from './dto/create-journal.dto';
import { PaginationDto } from 'src/common/dtos/pagination.dto';
import { UpdateJournalDto } from './dto/update-journal.dto';

@Injectable()
export class JournalService {
  constructor(private readonly prisma: PrismaService) {}

  async create(userId: string, dto: CreateJournalDto) {
    return this.prisma.journalEntry.create({
      data: {
        userId,
        ...dto,
      },
    });
  }

  async findAll(userId: string, pagination: PaginationDto) {
    const { cursor, limit = 10, search } = pagination;

    const where: any = { userId };
    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { content: { contains: search, mode: 'insensitive' } },
      ];
    }

    const entries = await this.prisma.journalEntry.findMany({
      where,
      take: limit + 1,
      cursor: cursor ? { id: cursor } : undefined,
      skip: cursor ? 1 : 0,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        title: true,
        content: true,
        audioUrl: true,
        mood: true,
        createdAt: true,
      },
    });

    let nextCursor: string | undefined = undefined;
    if (entries.length > limit) {
      const nextItem = entries.pop();
      nextCursor = nextItem?.id;
    }

    return {
      data: entries,
      meta: {
        nextCursor,
        hasNextPage: !!nextCursor,
      },
    };
  }

  async findOne(userId: string, journalId: string) {
    const entry = await this.prisma.journalEntry.findFirst({
      where: { id: journalId, userId },
    });

    if (!entry) {
      throw new NotFoundException('Journal entry not found');
    }

    return entry;
  }

  async delete(userId: string, journalId: string) {
    const entry = await this.prisma.journalEntry.findFirst({
      where: { id: journalId, userId },
      select: { id: true },
    });

    if (!entry) {
      throw new NotFoundException('Journal entry not found');
    }

    return this.prisma.journalEntry.delete({
      where: { id: journalId },
    });
  }

  async update(userId: string, id: string, dto: UpdateJournalDto) {
    const journal = await this.prisma.journalEntry.findFirst({
      where: { id, userId },
    });

    if (!journal) {
      throw new NotFoundException('Journal entry not found or access denied');
    }

    return this.prisma.journalEntry.update({
      where: { id },
      data: {
        ...dto,
      },
    });
  }

}