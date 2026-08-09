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
import { SkillsService } from './skills.service';
import { CreateSkillDto, LogSkillTimeDto } from './dto/skill.dto';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { UpdateSkillDto } from './dto/update-skill.dto';

@ApiTags('Skills')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('skills')
export class SkillsController {
  constructor(private readonly skillsService: SkillsService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new skill target' })
  create(@Req() req: any, @Body() dto: CreateSkillDto) {
    return this.skillsService.create(req.user.userId, dto);
  }

  @Get()
  @ApiOperation({ summary: 'Get all tracked skills and progress' })
  findAll(@Req() req: any) {
    return this.skillsService.findAll(req.user.userId);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update skill target hours, level, or name' })
  update(
    @Req() req: any,
    @Param('id') id: string,
    @Body() dto: UpdateSkillDto,
  ) {
    return this.skillsService.update(req.user.userId, id, dto);
  }

  @Patch(':id/log')
  @ApiOperation({ summary: 'Log hours toward a skill target' })
  logHours(
    @Req() req: any,
    @Param('id') skillId: string,
    @Body() dto: LogSkillTimeDto,
  ) {
    return this.skillsService.logHours(req.user.userId, skillId, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a skill' })
  delete(@Req() req: any, @Param('id') id: string) {
    return this.skillsService.delete(req.user.userId, id);
  }
}