import { PartialType } from '@nestjs/swagger';
import { CreateRoutineDto } from './routine.dto';

export class UpdateRoutineDto extends PartialType(CreateRoutineDto) {}
