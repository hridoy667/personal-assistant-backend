import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
  Req,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { RoutinesService } from './routines.service';
import { CreateRoutineDto, UpdateRoutineDto } from './dto/routine.dto';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';

@ApiTags('Routines')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('routines')
export class RoutinesController {
  constructor(private readonly routinesService: RoutinesService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new routine sequence' })
  create(@Req() req: any, @Body() dto: CreateRoutineDto) {
    return this.routinesService.create(req.user.userId, dto);
  }

  @Get()
  @ApiOperation({ summary: 'Get all user routines' })
  findAll(@Req() req: any) {
    return this.routinesService.findAll(req.user.userId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a specific routine' })
  findOne(@Req() req: any, @Param('id') id: string) {
    return this.routinesService.findOne(req.user.userId, id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a routine sequence or active state' })
  update(
    @Req() req: any,
    @Param('id') id: string,
    @Body() dto: UpdateRoutineDto,
  ) {
    return this.routinesService.update(req.user.userId, id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a routine' })
  delete(@Req() req: any, @Param('id') id: string) {
    return this.routinesService.delete(req.user.userId, id);
  }
}