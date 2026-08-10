import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsEnum,
  IsBoolean,
  IsOptional,
  IsArray,
  ValidateNested,
  IsInt,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import { RoutineType } from '@prisma/client';

export class RoutineStepDto {
  @ApiProperty({ example: 'Hydrate (500ml water)' })
  @IsString()
  title!: string;

  @ApiPropertyOptional({ example: 'Drink immediately after waking up' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ example: 10, description: 'Duration in minutes' })
  @IsInt()
  @Min(1)
  durationMins!: number;

  @ApiPropertyOptional({ example: 'After Fajr prayer' })
  @IsOptional()
  @IsString()
  trigger?: string;
}

export class CreateRoutineDto {
  @ApiProperty({ example: 'Morning Power Hour' })
  @IsString()
  title!: string;

  @ApiPropertyOptional({ enum: RoutineType, default: RoutineType.MORNING })
  @IsOptional()
  @IsEnum(RoutineType)
  type?: RoutineType;

  @ApiProperty({ type: [RoutineStepDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => RoutineStepDto)
  steps!: RoutineStepDto[];

  @ApiPropertyOptional({ example: true, default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdateRoutineDto {
  @ApiPropertyOptional({ example: 'Updated Morning Routine' })
  @IsOptional()
  @IsString()
  title?: string;

  @ApiPropertyOptional({ enum: RoutineType })
  @IsOptional()
  @IsEnum(RoutineType)
  type?: RoutineType;

  @ApiPropertyOptional({ type: [RoutineStepDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => RoutineStepDto)
  steps?: RoutineStepDto[];

  @ApiPropertyOptional({ example: false })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}