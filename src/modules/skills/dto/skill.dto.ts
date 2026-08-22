import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsNumber, IsOptional, Min } from 'class-validator';

export class CreateSkillDto {
  @ApiProperty({ example: 'Master React Native' })
  @IsString()
  title!: string;

  @ApiProperty({ example: 100 })
  @IsNumber()
  @Min(1)
  targetHours!: number;

  @ApiPropertyOptional({ example: 'Intermediate' })
  @IsOptional()
  @IsString()
  level?: string;
}

export class GenerateSkillRoadmapDto {
  @ApiProperty({ example: 'Master React Native Reanimated' })
  @IsString()
  title!: string;

  @ApiProperty({ example: 10, description: 'Target hours to master' })
  @IsNumber()
  @Min(1)
  targetHours!: number;

  @ApiPropertyOptional({ example: 'Intermediate' })
  @IsOptional()
  @IsString()
  level?: string;

  @ApiPropertyOptional({
    example: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ or notes text',
    description: 'Raw text, notes, or YouTube video link',
  })
  @IsOptional()
  @IsString()
  resources?: string;
}

export class LogSkillTimeDto {
  @ApiProperty({ example: 2.5, description: 'Hours spent practicing' })
  @IsNumber()
  @Min(0.1)
  hours!: number;
}