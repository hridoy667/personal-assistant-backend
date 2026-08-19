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

  @Post('log')
  @ApiOperation({ summary: 'Upsert daily health log (sleep, water, weight, energy)' })
  upsertLog(@Req() req: any, @Body() dto: CreateMoodLogDto) {
    return this.healthService.createMoodLog(req.user.userId, dto);
  }

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
}