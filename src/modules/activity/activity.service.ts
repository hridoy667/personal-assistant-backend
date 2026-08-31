import { Injectable } from '@nestjs/common';
import { CreateActivityLogDto } from './dto/CreateActivityLogDto.dto';
import { PrismaService } from '../prisma/prisma.service';
import { getUserDayBounds } from 'src/common/utils/day-bounds.util';
import { PaginationDto } from 'src/common/dtos/pagination.dto';

@Injectable()
export class ActivityService {

    constructor(
        private readonly prisma:PrismaService
    ){} 

    async createActivityLog(userId: string, dto: CreateActivityLogDto) {
        const loggedAt = dto.date ? new Date(dto.date) : new Date();

        await this.prisma.activityLog.create({
            data: {
                userId,
                type: dto.type,
                durationMin: dto.durationMin,
                note: dto.note,
                loggedAt,
            },
        });
        return{
            success:true,
            message:"Activity Logged Successfully"
        }
    }

    async getTodayActivities(userId: string, paginationDto: PaginationDto) {
    const { cursor, limit = 10 } = paginationDto;

    // 1. Calculate active day bounds for the user
    const dayBounds = await getUserDayBounds(userId);

    // 2. Query Prisma fetching 1 extra record to evaluate nextCursor
    const activities = await this.prisma.activityLog.findMany({
      where: {
        userId,
        loggedAt: {
          gte: dayBounds.dayStart,
          lte: dayBounds.dayEnd,
        },
      },
      take: limit + 1,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
      orderBy: { id: 'desc' }, // Cursor pagination requires a unique, ordered field
    });

    // 3. Evaluate pagination state
    let nextCursor: string | undefined = undefined;
    const hasNextPage = activities.length > limit;

    if (hasNextPage) {
      const nextItem = activities.pop(); // Remove the +1 item
      nextCursor = nextItem?.id;
    }

    return {
      bounds: {
        logicalDate: dayBounds.logicalDate,
        dayStart: dayBounds.dayStart,
        dayEnd: dayBounds.dayEnd,
        isCurrentlyAwake: dayBounds.isCurrentlyAwake,
      },
      data: activities,
      meta: {
        nextCursor,
        hasNextPage,
      },
    };
  }
}
