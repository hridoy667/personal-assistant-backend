import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString } from 'class-validator';
import { MoodLevel } from '@prisma/client';

export class CreateMoodLogDto {
  @ApiProperty({ enum: MoodLevel, example: MoodLevel.HIGH_ENERGY })
  @IsEnum(MoodLevel)
  mood!: MoodLevel;

  @ApiPropertyOptional({ example: 'Feeling productive after completing Fajr & morning routine' })
  @IsOptional()
  @IsString()
  note?: string;
}