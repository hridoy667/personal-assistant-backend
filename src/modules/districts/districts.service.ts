import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PaginationDto } from 'src/common/dtos/pagination.dto';

@Injectable()
export class DistrictsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(dto: PaginationDto = {}) {
    const { cursor, limit = 20, search } = dto || {};
    const cursorId = cursor ? Number(cursor) : undefined;
    const take = Number(limit || 20);

    const districts = await this.prisma.districts.findMany({
      select: { id: true, name: true },
      where: search
        ? { name: { contains: search, mode: 'insensitive' } }
        : undefined,
      orderBy: { id: 'asc' },
      skip: cursorId ? 1 : 0,
      cursor: cursorId ? { id: cursorId } : undefined,
      take: take + 1,
    });

    const hasMore = districts.length > take;
    const data = hasMore ? districts.slice(0, take) : districts;
    const nextCursor = hasMore ? String(data[data.length - 1].id) : null;

    return { data, nextCursor };
  }
}
