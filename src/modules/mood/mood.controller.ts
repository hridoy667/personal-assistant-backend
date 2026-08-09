import { Controller, Get, Post, Body, UseGuards, Req } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { MoodService } from './mood.service';
import { CreateMoodLogDto } from './dto/create-mood.dto';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';

@ApiTags('Mood')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('mood')
export class MoodController {
  constructor(private readonly moodService: MoodService) {}

  @Post()
  @ApiOperation({ summary: 'Log current mood snapshot (3-4x daily)' })
  create(@Req() req: any, @Body() dto: CreateMoodLogDto) {
    return this.moodService.create(req.user.userId, dto);
  }

  @Get('today')
  @ApiOperation({ summary: 'Get all mood entries logged today' })
  getDailyLogs(@Req() req: any) {
    return this.moodService.getDailyLogs(req.user.userId);
  }
}