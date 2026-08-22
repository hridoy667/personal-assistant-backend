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
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { HealthService } from './health.service';
import { CreateMoodLogDto } from './dto/health-log.dto';
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
  async getWellbeingInfo(
    @Req() req: any,
    @Query('latitude', new ParseFloatPipe({ optional: true })) latitude?: number,
    @Query('longitude', new ParseFloatPipe({ optional: true })) longitude?: number,
  ) {
    const userId = req.user.userId;
    return this.healthService.getWellbeingContext(userId, latitude, longitude);
  }

  @Get('active')
@ApiOperation({ summary: 'Get current active sleep session' })
async getActiveSession(@Req() req: any) {
  const session = await this.healthService.getActiveSleepSession(req.user.userId);
  
  return session ?? null; 
}

  @Post('start')
  @ApiOperation({ summary: 'Start a new sleep session' })
  async startSleep(
    @Req() req: any,
    @Body() body: { sleptAt?: string },
  ) {
    return this.healthService.startSleepSession(req.user.userId, body.sleptAt);
  }

  @Post(':id/wake')
  @ApiOperation({ summary: 'Log wake time for an active sleep session' })
  async wakeUp(
    @Req() req: any,
    @Param('id') sessionId: string,
    @Body() body: { wokeUpAt?: string },
  ) {
    return this.healthService.wakeUpSession(req.user.userId, sessionId, body.wokeUpAt);
  }
}