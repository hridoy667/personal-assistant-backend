import { PartialType } from '@nestjs/swagger';
import { UpsertHealthLogDto } from './health-log.dto';

export class UpdateHealthDto extends PartialType(UpsertHealthLogDto) {}
