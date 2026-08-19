import { ApiPropertyOptional, ApiProperty } from '@nestjs/swagger';
import { ActivityType } from '@prisma/client';
import { IsEnum, IsInt, IsOptional, IsString, IsDateString, Min, Max } from 'class-validator';

export class CreateActivityLogDto {
  @ApiProperty({ enum: ActivityType, example: ActivityType.DEEP_WORK })
  @IsEnum(ActivityType)
  type!: ActivityType;

  @ApiPropertyOptional({ example: 45, description: 'Duration in minutes' })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(1440)
  durationMin?: number;

  @ApiPropertyOptional({ example: 'Worked on database optimization', description: 'Optional activity note' })
  @IsOptional()
  @IsString()
  note?: string;

  @ApiPropertyOptional({ example: '2026-08-19T22:56:00Z' })
  @IsOptional()
  @IsDateString()
  date?: string;
}