import { Injectable } from '@nestjs/common';
import { CreateActivityLogDto } from './dto/CreateActivityLogDto.dto';
import { PrismaService } from '../prisma/prisma.service';

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
}
