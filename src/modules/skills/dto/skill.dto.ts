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

export class LogSkillTimeDto {
  @ApiProperty({ example: 2.5, description: 'Hours spent practicing today' })
  @IsNumber()
  @Min(0.1)
  hours!: number;
}