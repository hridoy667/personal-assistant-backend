import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Req,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { TasksService } from './tasks.service';
import { CreateTaskDto } from './dto/create-task.dto';
import { PaginationDto } from 'src/common/dtos/pagination.dto';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { UpdateTaskDto } from './dto/update-task.dto';

@ApiTags('Tasks')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('tasks')
export class TasksController {
  constructor(private readonly tasksService: TasksService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new task' })
  create(@Req() req: any, @Body() dto: CreateTaskDto) {
    return this.tasksService.create(req.user.userId, dto);
  }

  @Get()
  @ApiOperation({ summary: 'Get cursor-paginated tasks for logged-in user' })
  findAll(@Req() req: any, @Query() pagination: PaginationDto) {
    return this.tasksService.findAll(req.user.userId, pagination);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get single task for logged-in user' })
  getOne(@Req() req: any, @Param('id') id: string) {
    return this.tasksService.getOne(req.user.userId, id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update details of a task' })
  update(
    @Req() req: any,
    @Param('id') id: string,
    @Body() dto: UpdateTaskDto,
  ) {
    return this.tasksService.update(req.user.userId, id, dto);
  }

  @Patch(':id/toggle')
  @ApiOperation({ summary: 'Toggle completion status of a task' })
  toggleComplete(@Req() req: any, @Param('id') id: string) {
    return this.tasksService.toggleComplete(req.user.userId, id);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a task' })
  delete(@Req() req: any, @Param('id') id: string) {
    return this.tasksService.delete(req.user.userId, id);
  }
}