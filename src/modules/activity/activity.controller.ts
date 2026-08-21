import { Body, Controller, Post, Req, UseGuards } from '@nestjs/common';
import { ActivityService } from './activity.service';
import { ApiOperation } from '@nestjs/swagger';
import { CreateActivityLogDto } from './dto/CreateActivityLogDto.dto';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';

@UseGuards(JwtAuthGuard)
@Controller('activity')
export class ActivityController {
  constructor(private readonly activityService: ActivityService) {}

  @Post('create')
  @ApiOperation({ summary: 'Log a daily activity (working, walking, eating, etc.)' })
  async createActivityLog(@Req() req: any, @Body() dto: CreateActivityLogDto) {
    return this.activityService.createActivityLog(req.user.userId, dto);
  }
  
}
