import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsEnum, IsNumber, Min, IsArray } from 'class-validator';
import { HabitType } from '@prisma/client';

export enum WeekDay {
  DAILY = 'DAILY',
  SUNDAY = 'SUNDAY',
  MONDAY = 'MONDAY',
  TUESDAY = 'TUESDAY',
  WEDNESDAY = 'WEDNESDAY',
  THURSDAY = 'THURSDAY',
  FRIDAY = 'FRIDAY',
  SATURDAY = 'SATURDAY',
}

export class CreateHabitDto {
  @ApiProperty({ example: 'Read Quran / Books' })
  @IsString()
  title!: string;

  @ApiPropertyOptional({ enum: HabitType, default: HabitType.BINARY })
  @IsOptional()
  @IsEnum(HabitType)
  type?: HabitType;

  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @IsNumber()
  @Min(0.1)
  targetValue?: number;

  @ApiPropertyOptional({ example: 'pages' })
  @IsOptional()
  @IsString()
  unit?: string;

  @ApiProperty({
    example: ['DAILY'],
    description: "['DAILY'] or array like ['MONDAY', 'FRIDAY']",
  })
  @IsArray()
  @IsString({ each: true })
  frequency!: string[];
}