import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  UseGuards,
  Req,
  ParseIntPipe,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { HealthService } from './health.service';
import { UpsertHealthLogDto } from './dto/health-log.dto';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';

@ApiTags('Health Logs')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('health')
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Post('log')
  @ApiOperation({ summary: 'Upsert daily health log (sleep, water, weight, energy)' })
  upsertLog(@Req() req: any, @Body() dto: UpsertHealthLogDto) {
    return this.healthService.upsertLog(req.user.userId, dto);
  }

  @Get('history')
  @ApiOperation({ summary: 'Get historical health metrics' })
  getHealthHistory(
    @Req() req: any,
    @Query('days', new ParseIntPipe({ optional: true })) days?: number,
  ) {
    return this.healthService.getHealthHistory(req.user.userId, days ?? 30);
  }
}