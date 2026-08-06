import { BadRequestException, ForbiddenException, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service'; // Adjust path depending on your repo structure
import { CreateComplainDto } from './dto/create-complain.dto';
import { UpdateComplainDto } from './dto/update-complain.dto';
import * as crypto from 'crypto';
import { PaginationDto } from 'src/common/dtos/pagination.dto';
import { MailService } from 'src/mail/mail.service';

@Injectable()
export class ComplainService {
  constructor(private readonly prisma: PrismaService,
    private readonly mailService: MailService,
  ) { }


  private generateTicketCode(): string {
    const randomHex = crypto.randomBytes(3).toString('hex').toUpperCase();
    return `CMP-${randomHex}`;
  }

  async create(userId: string, createComplainDto: CreateComplainDto) {

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('User not found.');
    }

    const ticketCode = this.generateTicketCode();

    const complain = await this.prisma.complain.create({
      data: {
        ticket: ticketCode,
        title: createComplainDto.title,
        body: createComplainDto.body,
        category: createComplainDto.category,
        userId: userId,
      },
    });

    await this.mailService.sendNewComplainNotification({
      complainantName: user.name,
      complainantEmail: user.email || 'Not provided',
      complainantPhone: user.phone || 'Not provided',
      complainDescription: createComplainDto.body,
    });

    return {
      success: true,
      message: 'Complaint ticket created successfully.',
      data: complain,
    };
  }

  async findAllByUser(userId: string, paginationDto: PaginationDto) {
    const { cursor, limit = 10 } = paginationDto;

    const take = limit + 1;

    const complains = await this.prisma.complain.findMany({
      where: {
        userId: userId,
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            phone: true, // adjust field name if it's 'phoneNumber' or similar in your schema
          }
        }
      },
      take: take,
      skip: cursor ? 1 : 0,
      cursor: cursor ? { id: cursor } : undefined,
      orderBy: {
        id: 'desc',
      },
    });

    const hasNextPage = complains.length > limit;

    if (hasNextPage) {
      complains.pop(); // Remove the extra record used for evaluation
    }

    const nextCursor = complains.length > 0 ? complains[complains.length - 1].id : null;

    return {
      success: true,
      data: complains,
      meta: {
        hasNextPage,
        nextCursor: hasNextPage ? nextCursor : null,
      },
    };
  }

  async findOne(id: string, userId: string) {
    const user = await this.prisma.user.findFirst({
      where: { id: userId },
      select: { type: true }
    });

    const isAdmin = user?.type === 'ADMIN';

    const complain = await this.prisma.complain.findFirst({
      where: {
        id,
        ...(isAdmin ? {} : { userId }),
      },
    });

    if (!complain) {
      throw new NotFoundException('Complaint ticket not found or access denied.');
    }

    if (isAdmin) {
      const updatedComplain = await this.prisma.complain.update({
        where: { id },
        data: { isSeen: true },
      });

      return {
        success: true,
        data: updatedComplain,
      };
    }
    return {
      success: true,
      data: complain,
    };
  }

  async updateComplain(id: string, userId: string, dto: UpdateComplainDto) {
    // 1. Fetch user role configuration
    const user = await this.prisma.user.findFirst({
      where: { id: userId },
      select: { type: true },
    });

    if (!user) {
      throw new NotFoundException('User profile record not found.');
    }

    const isAdmin = user.type === 'ADMIN';

    // 2. Fetch target complaint ticket
    const existingComplain = await this.prisma.complain.findUnique({
      where: { id },
    });

    if (!existingComplain) {
      throw new NotFoundException('Complaint ticket record not found.');
    }

    const updateData: any = {};

    // 3. Conditional validation logic based on role
    if (isAdmin) {
      // Admins cannot change content details, only resolution states
      if (dto.title || dto.body || dto.category) {
        throw new ForbiddenException('Administrators cannot modify user complaint details (title, body, category).');
      }

      if (dto.status) updateData.status = dto.status;
      if (dto.solution) updateData.solution = dto.solution;

      if (Object.keys(updateData).length === 0) {
        throw new BadRequestException('No valid updates provided for Administrator actions (status or solution).');
      }
    } else {
      // User Access Control & Security Verification
      if (existingComplain.userId !== userId) {
        throw new ForbiddenException('Access denied: You do not own this ticket.');
      }
      if (existingComplain.status !== 'PENDING') {
        throw new BadRequestException('Cannot modify a complaint ticket once processing has begun.');
      }
      if (dto.status || dto.solution) {
        throw new ForbiddenException('Only administrators can update the status or solution text.');
      }

      if (dto.title) updateData.title = dto.title;
      if (dto.body) updateData.body = dto.body;
      if (dto.category) updateData.category = dto.category;

      if (Object.keys(updateData).length === 0) {
        throw new BadRequestException('No fields provided to update.');
      }
    }

    // 4. Commit query securely
    const updated = await this.prisma.complain.update({
      where: { id },
      data: updateData,
    });

    return {
      success: true,
      message: 'Complaint ticket updated successfully.',
      data: updated,
    };
  }

  async deleteComplain(id: string, userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { type: true }
    });

    if (!user) {
      throw new ForbiddenException('Access denied. Authentication required.');
    }

    if (user.type !== 'ADMIN') {
      throw new ForbiddenException('Access denied. Only system administrators can delete complaints.');
    }

    const complain = await this.prisma.complain.findUnique({
      where: { id }
    });

    if (!complain) {
      throw new NotFoundException('Complaint record not found.');
    }

    await this.prisma.complain.delete({
      where: { id }
    });

    return {
      success: true,
      message: 'Complaint deleted successfully.'
    };
  }
}