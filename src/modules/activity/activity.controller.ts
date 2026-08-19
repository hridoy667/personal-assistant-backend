import { Body, Controller, Post, Req } from '@nestjs/common';
import { ActivityService } from './activity.service';
import { ApiOperation } from '@nestjs/swagger';
import { CreateActivityLogDto } from './dto/CreateActivityLogDto.dto';

@Controller('activity')
export class ActivityController {
  constructor(private readonly activityService: ActivityService) {}

  @Post('create')
  @ApiOperation({ summary: 'Log a daily activity (working, walking, eating, etc.)' })
  async createActivityLog(@Req() req: any, @Body() dto: CreateActivityLogDto) {
    return this.activityService.createActivityLog(req.user.id, dto);
  }
  
}
