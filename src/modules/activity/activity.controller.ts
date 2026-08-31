import { Body, Controller, Get, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ActivityService } from './activity.service';
import { ApiOperation } from '@nestjs/swagger';
import { CreateActivityLogDto } from './dto/CreateActivityLogDto.dto';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { PaginationDto } from 'src/common/dtos/pagination.dto';

@UseGuards(JwtAuthGuard)
@Controller('activity')
export class ActivityController {
  constructor(private readonly activityService: ActivityService) {}

  @Post('create')
  @ApiOperation({ summary: 'Log a daily activity (working, walking, eating, etc.)' })
  async createActivityLog(@Req() req: any, @Body() dto: CreateActivityLogDto) {
    return this.activityService.createActivityLog(req.user.userId, dto);
  }

  @Get('today')
  async getTodayActivities(
    @Req() req: any,
    @Query() paginationDto: PaginationDto,
  ) {
    return this.activityService.getTodayActivities(req.user.id, paginationDto);
  }
  
}
