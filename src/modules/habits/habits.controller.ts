import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  UseGuards,
  Req,
  Patch,
  Delete,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { HabitsService } from './habits.service';
import { CreateHabitDto } from './dto/create-habit.dto';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { UpdateHabitDto } from './dto/update-habit.dto';

@ApiTags('Habits')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('habits')
export class HabitsController {
  constructor(private readonly habitsService: HabitsService) { }

  @Post()
  @ApiOperation({ summary: 'Create a new scheduled habit' })
  create(@Req() req: any, @Body() dto: CreateHabitDto) {
    return this.habitsService.create(req.user.userId, dto);
  }

  @Get()
  @ApiOperation({ summary: 'Get all active habits with recent tasks' })
  findAll(@Req() req: any) {
    return this.habitsService.findAll(req.user.userId);
  }

  @Get(':id/streaks')
  @ApiOperation({ summary: 'Get streak statistics and total completions for a habit' })
  getStreaks(@Req() req: any, @Param('id') id: string) {
    return this.habitsService.getStreaks(req.user.userId, id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update habit settings or frequency' })
  update(
    @Req() req: any,
    @Param('id') id: string,
    @Body() dto: UpdateHabitDto,
  ) {
    return this.habitsService.update(req.user.userId, id, dto);
  }

 @Delete(':id')
  @ApiOperation({ summary: 'Delete habit' })
  delete(@Req() req: any, @Param('id') id: string) {
    return this.habitsService.deleteHabit(req.user.userId, id);
  }
}