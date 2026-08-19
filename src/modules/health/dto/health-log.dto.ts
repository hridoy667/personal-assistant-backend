import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsNumber,
  IsInt,
  IsOptional,
  IsDateString,
  IsEnum,
  IsArray,
  IsString,
  Min,
  Max,
} from 'class-validator';

export enum MoodLevel {
  LOW_ENERGY = 'LOW_ENERGY',
  DEPRESSED = 'DEPRESSED',
  ANXIOUS = 'ANXIOUS',
  BALANCED = 'BALANCED',
  HIGH_ENERGY = 'HIGH_ENERGY',
}

export class CreateMoodLogDto {
  @ApiPropertyOptional({ example: '2026-08-19T22:37:42Z', description: 'Log date or full ISO string' })
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

  @ApiPropertyOptional({ enum: MoodLevel, example: MoodLevel.BALANCED })
  @IsOptional()
  @IsEnum(MoodLevel)
  mood?: MoodLevel;

  @ApiPropertyOptional({ example: 4, description: 'Energy level from 1 to 5' })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(5)
  energyScore?: number;

  @ApiPropertyOptional({ example: ['WORK', 'MEETING', 'CAFFEINE'], type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  contextTags?: string[];

  @ApiPropertyOptional({ example: ['HEADACHE', 'EYE_STRAIN'], type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  symptoms?: string[];

  @ApiPropertyOptional({ example: 'Felt tired after mid-day meeting', description: 'Optional personal note' })
  @IsOptional()
  @IsString()
  note?: string;
}