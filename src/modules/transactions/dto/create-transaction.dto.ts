import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsNumber,
  IsBoolean,
  IsOptional,
  IsDateString,
  Min,
} from 'class-validator';

export class CreateTransactionDto {
  @ApiProperty({ example: 450.5 })
  @IsNumber()
  @Min(0.01)
  amount!: number;

  @ApiProperty({ example: 'Groceries' })
  @IsString()
  category!: string;

  @ApiPropertyOptional({ example: true, default: true })
  @IsOptional()
  @IsBoolean()
  isExpense?: boolean;

  @ApiPropertyOptional({ example: 'Supermarket weekly haul' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ example: false, default: false })
  @IsOptional()
  @IsBoolean()
  isRecurring?: boolean;

  @ApiPropertyOptional({ example: '2026-08-09T14:30:00.000Z' })
  @IsOptional()
  @IsDateString()
  transactedAt?: string;
}