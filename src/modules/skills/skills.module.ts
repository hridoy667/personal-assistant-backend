import { Module } from '@nestjs/common';
import { SkillsService } from './skills.service';
import { SkillsController } from './skills.controller';
import { SkillsAiService } from './skills-ai.service';

@Module({
  controllers: [SkillsController],
  providers: [SkillsService,SkillsAiService],
})
export class SkillsModule {}
