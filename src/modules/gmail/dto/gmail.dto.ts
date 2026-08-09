import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsBoolean, IsOptional, IsDateString, IsEnum } from 'class-validator';
import { TaskPriority, EnergyRequirement } from '@prisma/client';

export class IngestSyncedEmailDto {
  @ApiProperty({ example: '18d9f12a3b4c5d6e' })
  @IsString()
  gmailMessageId!: string;

  @ApiProperty({ example: 'john.doe@example.com' })
  @IsString()
  sender!: string;

  @ApiProperty({ example: 'Project Q3 Update Required' })
  @IsString()
  subject!: string;

  @ApiPropertyOptional({ example: 'Please find attached the financial review...' })
  @IsOptional()
  @IsString()
  snippet?: string;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  isActionRequired?: boolean;

  @ApiProperty({ example: '2026-08-09T18:20:00.000Z' })
  @IsDateString()
  receivedAt!: string;
}

export class ConvertEmailToTaskDto {
  @ApiPropertyOptional({ example: '2026-08-12T17:00:00.000Z' })
  @IsOptional()
  @IsDateString()
  dueDate?: string;

  @ApiPropertyOptional({ enum: TaskPriority, default: TaskPriority.P2_HIGH })
  @IsOptional()
  @IsEnum(TaskPriority)
  priority?: TaskPriority;

  @ApiPropertyOptional({ enum: EnergyRequirement, default: EnergyRequirement.HIGH })
  @IsOptional()
  @IsEnum(EnergyRequirement)
  energyRequired?: EnergyRequirement;
}