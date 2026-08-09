import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsNumber,
  IsInt,
  IsOptional,
  IsDateString,
  Min,
  Max,
} from 'class-validator';

export class UpsertHealthLogDto {
  @ApiPropertyOptional({ example: '2026-08-09' })
  @IsOptional()
  @IsDateString()
  date?: string;

  @ApiPropertyOptional({ example: 7.5, description: 'Hours of sleep' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(24)
  sleepHours?: number;

  @ApiPropertyOptional({ example: 2500, description: 'Water intake in ml' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  waterIntakeMl?: number;

  @ApiPropertyOptional({ example: 72.5, description: 'Weight in kg' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  weightKg?: number;

  @ApiPropertyOptional({ example: 8, description: 'Energy level 1-10' })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(10)
  energyScore?: number;
}