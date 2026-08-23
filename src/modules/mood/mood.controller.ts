import { Controller, Get, Post, Body, UseGuards, Req, Param, Patch,Headers as NestHeaders } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { MoodService } from './mood.service';
import { CreateMoodLogDto } from './dto/create-mood.dto';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { UpdateMoodDto } from './dto/update-mood.dto';

@ApiTags('Mood')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('mood')
export class MoodController {
  constructor(private readonly moodService: MoodService) { }

  @Post()
  @ApiOperation({ summary: 'Log current mood snapshot (3-4x daily)' })
  create(@Req() req: any, @Body() dto: CreateMoodLogDto) {
    return this.moodService.create(req.user.userId, dto);
  }

  @Get('today')
  @ApiOperation({ summary: "Get all mood entries logged in today's logical day bounds" })
  getDailyLogs(
    @Req() req: any,
    @NestHeaders('x-timezone') userTimeZone: string,
  ) {
    return this.moodService.getDailyLogs(req.user.userId, userTimeZone);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update an existing mood score or log reflection' })
  update(
    @Req() req: any,
    @Param('id') id: string,
    @Body() dto: UpdateMoodDto,
  ) {
    return this.moodService.update(req.user.userId, id, dto);
  }

}