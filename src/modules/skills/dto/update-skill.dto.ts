import { PartialType } from '@nestjs/swagger';
import { CreateSkillDto } from './skill.dto';

export class UpdateSkillDto extends PartialType(CreateSkillDto) {}