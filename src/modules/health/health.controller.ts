import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  UseGuards,
  Req,
  ParseIntPipe,
  ParseFloatPipe,
  Param,
  Patch,
  Headers as NestHeaders
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { HealthService } from './health.service';
import { 
  StartSleepDto, 
  WakeUpDto, 
  UpsertSleepLogDto, 
  SleepStatsQueryDto 
} from './dto/health-log.dto';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';

@ApiTags('Health Logs')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('health')
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Get('history')
  @ApiOperation({ summary: 'Get historical health metrics' })
  getHealthHistory(
    @Req() req: any,
    @Query('days', new ParseIntPipe({ optional: true })) days?: number,
  ) {
    return this.healthService.getHealthHistory(req.user.userId, days ?? 30);
  }

  @Get('wellbeing')
  @ApiOperation({ summary: 'Get wellbeing context' })
  async getWellbeingInfo(
    @Req() req: any
  ) {
    return this.healthService.getWellbeingContext(req.user.userId);
  }

  @Get('active')
  @ApiOperation({ summary: 'Get current active sleep session' })
  async getActiveSession(@Req() req: any) {
    const session = await this.healthService.getActiveSleepSession(req.user.userId);
    return session ?? null;
  }

  @Post('start')
  @ApiOperation({ summary: 'Start a new live sleep session' })
  async startSleep(
    @Req() req: any,
    @Body() dto: StartSleepDto,
  ) {
    return this.healthService.startSleepSession(req.user.userId, dto.sleptAt);
  }

  @Post(':id/wake')
  @ApiOperation({ summary: 'Log wake time for an active sleep session' })
  async wakeUp(
    @Req() req: any,
    @Param('id') sessionId: string,
    @Body() dto: WakeUpDto,
  ) {
    return this.healthService.wakeUpSession(
      req.user.userId,
      sessionId,
      dto.wokeUpAt,
      dto.qualityRating,
    );
  }

  @Patch('manual-log')
  @ApiOperation({ summary: 'Update a previous days sleep (up to 7 days)' })
  async upsertHistoricalLog(
    @Req() req: any,
    @Body() dto: UpsertSleepLogDto,
  ) {
    return this.healthService.upsertHistoricalSleepLog(req.user.userId, dto);
  }

@Get('stats')
@ApiOperation({ summary: 'Get sleep chart data (day, week, month, year)' })
async getSleepStats(
  @Req() req: any,
  @NestHeaders('x-timezone') userTimeZone: string,
  @Query() query: SleepStatsQueryDto,
) {
  return this.healthService.getSleepAnalytics(
    req.user.userId,
    query,
    userTimeZone,
  );
}
}