import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsOptional,
  IsEnum,
  IsBoolean,
  IsInt,
  IsDateString,
  IsArray,
  Min,
} from 'class-validator';
import { TaskPriority, EnergyRequirement } from '@prisma/client';

export class CreateTaskDto {
  @ApiProperty({ example: 'Finish NestJS Auth Module' })
  @IsString()
  title!: string;

  @ApiPropertyOptional({ example: 'Implement JWT refresh token and guards' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ enum: TaskPriority, default: TaskPriority.P3_MEDIUM })
  @IsOptional()
  @IsEnum(TaskPriority)
  priority?: TaskPriority;

  @ApiPropertyOptional({ enum: EnergyRequirement, default: EnergyRequirement.MEDIUM })
  @IsOptional()
  @IsEnum(EnergyRequirement)
  energyRequired?: EnergyRequirement;

  @ApiPropertyOptional({ example: '2026-08-10T10:00:00.000Z' })
  @IsOptional()
  @IsDateString()
  dueDate?: string;

  @ApiPropertyOptional({ example: 45 })
  @IsOptional()
  @IsInt()
  @Min(1)
  estimatedMinutes?: number;

  @ApiPropertyOptional({ example: false })
  @IsOptional()
  @IsBoolean()
  isTopPriority?: boolean;

  @ApiPropertyOptional({ example: 'FREQ=DAILY' })
  @IsOptional()
  @IsString()
  recurrenceRule?: string;

  @ApiPropertyOptional({ example: 'Work' })
  @IsOptional()
  @IsString()
  category?: string;

  @ApiPropertyOptional({ example: ['backend', 'nestjs'] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @ApiPropertyOptional({ example: 'cuid_of_parent_task' })
  @IsOptional()
  @IsString()
  parentId?: string;
}