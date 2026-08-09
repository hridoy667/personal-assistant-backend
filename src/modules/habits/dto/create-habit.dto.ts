import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsEnum, IsNumber, Min } from 'class-validator';
import { HabitType } from '@prisma/client';

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
}

export class LogHabitDto {
  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @IsNumber()
  @Min(0.1)
  value?: number;
}