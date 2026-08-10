import { PartialType } from '@nestjs/swagger';
import { CreateMoodLogDto } from './create-mood.dto';

export class UpdateMoodDto extends PartialType(CreateMoodLogDto) {}