import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { MoodLevel } from '@prisma/client';

export class CreateMoodLogDto {
  @ApiProperty({ enum: MoodLevel, example: MoodLevel.HIGH_ENERGY })
  @IsEnum(MoodLevel)
  mood!: MoodLevel;

  @ApiPropertyOptional({ example: 4, description: 'Energy level from 1 to 5' })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(5)
  energyScore?: number;

  @ApiPropertyOptional({ example: 'Feeling productive after completing Fajr & morning routine' })
  @IsOptional()
  @IsString()
  note?: string;
}