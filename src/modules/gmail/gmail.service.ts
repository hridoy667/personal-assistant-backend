import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { IngestSyncedEmailDto, ConvertEmailToTaskDto } from './dto/gmail.dto';
import { PaginationDto } from 'src/common/dtos/pagination.dto';

@Injectable()
export class GmailService {
  constructor(private readonly prisma: PrismaService) {}

  async ingestEmail(userId: string, dto: IngestSyncedEmailDto) {
    const existing = await this.prisma.syncedEmail.findUnique({
      where: { gmailMessageId: dto.gmailMessageId },
    });

    if (existing) {
      return existing; // Idempotent return
    }

    return this.prisma.syncedEmail.create({
      data: {
        userId,
        gmailMessageId: dto.gmailMessageId,
        sender: dto.sender,
        subject: dto.subject,
        snippet: dto.snippet,
        isActionRequired: dto.isActionRequired ?? false,
        receivedAt: new Date(dto.receivedAt),
      },
    });
  }

  async getSyncedEmails(userId: string, pagination: PaginationDto) {
    const { cursor, limit = 10, search } = pagination;

    const where: any = { userId };
    if (search) {
      where.OR = [
        { subject: { contains: search, mode: 'insensitive' } },
        { sender: { contains: search, mode: 'insensitive' } },
        { snippet: { contains: search, mode: 'insensitive' } },
      ];
    }

    const emails = await this.prisma.syncedEmail.findMany({
      where,
      take: limit + 1,
      cursor: cursor ? { id: cursor } : undefined,
      skip: cursor ? 1 : 0,
      orderBy: { receivedAt: 'desc' },
      include: {
        task: {
          select: { id: true, isCompleted: true, priority: true },
        },
      },
    });

    let nextCursor: string | undefined = undefined;
    if (emails.length > limit) {
      const nextItem = emails.pop();
      nextCursor = nextItem?.id;
    }

    return {
      data: emails,
      meta: {
        nextCursor,
        hasNextPage: !!nextCursor,
      },
    };
  }

  async convertToTask(userId: string, emailId: string, dto: ConvertEmailToTaskDto) {
    const email = await this.prisma.syncedEmail.findFirst({
      where: { id: emailId, userId },
      include: { task: true },
    });

    if (!email) {
      throw new NotFoundException('Synced email record not found');
    }

    if (email.task) {
      throw new ConflictException('A task has already been generated from this email');
    }

    return this.prisma.$transaction(async (tx) => {
      const task = await tx.task.create({
        data: {
          userId,
          title: `Reply: ${email.subject}`,
          description: `From: ${email.sender}\n\nSnippet:\n${email.snippet ?? 'N/A'}`,
          priority: dto.priority ?? 'P2_HIGH',
          energyRequired: dto.energyRequired ?? 'HIGH',
          dueDate: dto.dueDate ? new Date(dto.dueDate) : null,
          category: 'Email Task',
          syncedEmailId: email.id,
        },
      });

      await tx.syncedEmail.update({
        where: { id: email.id },
        data: { isActionRequired: true },
      });

      return task;
    });
  }
}