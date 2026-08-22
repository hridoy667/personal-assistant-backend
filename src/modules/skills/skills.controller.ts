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
import { GenerateSkillRoadmapDto, LogSkillTimeDto } from './dto/skill.dto';
import { UpdateSkillDto } from './dto/update-skill.dto';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';

@ApiTags('Skills')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('skills')
export class SkillsController {
  constructor(private readonly skillsService: SkillsService) {}

  @Post('generate')
  @ApiOperation({
    summary:
      'Create a skill and generate theory, timestamped video links & practice tasks',
  })
  generateSkill(@Req() req: any, @Body() dto: GenerateSkillRoadmapDto) {
    return this.skillsService.generateSkillWithRoadmap(req.user.userId, dto);
  }

  @Get()
  @ApiOperation({ summary: 'Get all active skills with module counts' })
  findAll(@Req() req: any) {
    return this.skillsService.findAll(req.user.userId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a single skill with all its modules' })
  findOne(@Req() req: any, @Param('id') id: string) {
    return this.skillsService.findOne(req.user.userId, id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update skill details (title, targetHours, level)' })
  update(
    @Req() req: any,
    @Param('id') id: string,
    @Body() dto: UpdateSkillDto,
  ) {
    return this.skillsService.update(req.user.userId, id, dto);
  }

  @Patch(':id/log')
  @ApiOperation({ summary: 'Manually log hours spent practicing a skill' })
  logHours(
    @Req() req: any,
    @Param('id') skillId: string,
    @Body() dto: LogSkillTimeDto,
  ) {
    return this.skillsService.logHours(req.user.userId, skillId, dto);
  }

  @Patch('modules/:moduleId/toggle')
  @ApiOperation({ summary: 'Toggle completion state of a skill module' })
  toggleModule(@Req() req: any, @Param('moduleId') moduleId: string) {
    return this.skillsService.toggleModuleComplete(req.user.userId, moduleId);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a skill and its associated modules' })
  delete(@Req() req: any, @Param('id') id: string) {
    return this.skillsService.delete(req.user.userId, id);
  }
}