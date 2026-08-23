import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsOptional, IsInt, Min, Max, IsEnum, IsNotEmpty } from 'class-validator';

export enum StatsTimeframe {
  DAY = 'DAY',
  WEEK = 'WEEK',
  MONTH = 'MONTH',
  YEAR = 'YEAR',
}

export class StartSleepDto {
  @ApiPropertyOptional({ example: '2026-08-19T22:37:42Z' })
  @IsOptional()
  @IsDateString()
  sleptAt?: string;
}

export class WakeUpDto {
  @ApiPropertyOptional({ example: '2026-08-20T06:37:42Z' })
  @IsOptional()
  @IsDateString()
  wokeUpAt?: string;

  @ApiPropertyOptional({ example: 4, description: 'Rating 1 to 5' })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(5)
  qualityRating?: number;
}

export class UpsertSleepLogDto {
  @ApiProperty({ example: '2026-08-15', description: 'The logical day to update' })
  @IsNotEmpty()
  @IsDateString()
  targetDate!: string;

  @ApiProperty({ example: '2026-08-15T23:30:00Z' })
  @IsNotEmpty()
  @IsDateString()
  sleptAt!: string;

  @ApiProperty({ example: '2026-08-16T07:00:00Z' })
  @IsNotEmpty()
  @IsDateString()
  wokeUpAt!: string;

  @ApiPropertyOptional({ example: 4 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(5)
  qualityRating?: number;
}

export class SleepStatsQueryDto {
  @ApiPropertyOptional({ enum: StatsTimeframe, default: StatsTimeframe.WEEK })
  @IsOptional()
  @IsEnum(StatsTimeframe)
  timeframe?: StatsTimeframe = StatsTimeframe.WEEK;

  @ApiPropertyOptional({ description: 'Target anchor date (defaults to today)', example: '2026-08-23' })
  @IsOptional()
  @IsDateString()
  date?: string;
}