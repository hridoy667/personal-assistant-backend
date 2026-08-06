import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PolicyType } from '@prisma/client';

@Injectable()
export class LegalService {
  constructor(private readonly prisma: PrismaService) {}

  async getActivePolicy(type: PolicyType) {
    // 🟢 FIXED: Querying "legals" instead of "privacyPolicy"
    const policy = await this.prisma.legals.findFirst({
      where: {
        type: type,
        isActive: true,
      },
      select: {
        type: true,
        version: true,
        content: true,
        updatedAt: true,
      },
    });

    if (!policy) {
      throw new NotFoundException(`Active document for ${type} not found`);
    }

    return {
      success: true,
      data: policy,
    };
  }
}