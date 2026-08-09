import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsNumber,
  IsInt,
  IsOptional,
  IsDateString,
  Min,
  Max,
} from 'class-validator';

// --- BUDGET DTOs ---
export class CreateBudgetDto {
  @ApiProperty({ example: 'Groceries' })
  @IsString()
  category!: string;

  @ApiProperty({ example: 15000 })
  @IsNumber()
  @Min(1)
  limit!: number;

  @ApiProperty({ example: 8, description: '1-12 month number' })
  @IsInt()
  @Min(1)
  @Max(12)
  month!: number;

  @ApiProperty({ example: 2026 })
  @IsInt()
  @Min(2024)
  year!: number;
}

// --- SAVINGS GOAL DTOs ---
export class CreateSavingsGoalDto {
  @ApiProperty({ example: 'Emergency Fund' })
  @IsString()
  title!: string;

  @ApiProperty({ example: 100000 })
  @IsNumber()
  @Min(1)
  targetAmount!: number;

  @ApiPropertyOptional({ example: 5000, default: 0 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  currentAmount?: number;

  @ApiPropertyOptional({ example: '2026-12-31T23:59:59.000Z' })
  @IsOptional()
  @IsDateString()
  targetDate?: string;
}

export class DepositSavingsDto {
  @ApiProperty({ example: 2500 })
  @IsNumber()
  @Min(0.01)
  amount!: number;
}