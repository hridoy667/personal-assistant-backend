import { Controller, Get, Post, Body, Query, UseGuards, Req } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { ScreenTimeService } from './screen-time.service';
import { BatchSyncScreenTimeDto } from './dto/screen-time.dto';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';

@ApiTags('Screen Time & App Usage')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('screen-time')
export class ScreenTimeController {
  constructor(private readonly screenTimeService: ScreenTimeService) {}

  @Post('sync')
  @ApiOperation({ summary: 'Batch sync device screen time and application usages' })
  syncScreenTime(@Req() req: any, @Body() dto: BatchSyncScreenTimeDto) {
    return this.screenTimeService.syncScreenTime(req.user.userId, dto);
  }

  @Get('summary')
  @ApiOperation({ summary: 'Get daily screen time and per-app stats' })
  getDailySummary(@Req() req: any, @Query('date') date?: string) {
    return this.screenTimeService.getDailySummary(req.user.userId, date);
  }
}