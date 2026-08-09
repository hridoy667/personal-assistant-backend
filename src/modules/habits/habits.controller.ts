import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  UseGuards,
  Req,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { HabitsService } from './habits.service';
import { CreateHabitDto, LogHabitDto } from './dto/create-habit.dto';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';

@ApiTags('Habits')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('habits')
export class HabitsController {
  constructor(private readonly habitsService: HabitsService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new habit' })
  create(@Req() req: any, @Body() dto: CreateHabitDto) {
    return this.habitsService.create(req.user.userId, dto);
  }

  @Get()
  @ApiOperation({ summary: 'Get all active habits with recent logs' })
  findAll(@Req() req: any) {
    return this.habitsService.findAll(req.user.userId);
  }

  @Post(':id/log')
  @ApiOperation({ summary: 'Log daily progress or completion for a habit' })
  logProgress(
    @Req() req: any,
    @Param('id') habitId: string,
    @Body() dto: LogHabitDto,
  ) {
    return this.habitsService.logProgress(req.user.userId, habitId, dto);
  }
}