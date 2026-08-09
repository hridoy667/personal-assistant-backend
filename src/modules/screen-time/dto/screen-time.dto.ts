import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsInt,
  IsNumber,
  IsEnum,
  IsOptional,
  IsArray,
  ValidateNested,
  IsDateString,
  Min,
  Max,
} from 'class-validator';
import { Type } from 'class-transformer';
import { AppCategory } from '@prisma/client';

export enum DeviceOsDto {
  ANDROID = 'ANDROID',
  IOS = 'IOS',
  WEB = 'WEB',
}

export class AppUsageItemDto {
  @ApiPropertyOptional({ example: 'com.instagram.android', description: 'Package name (Android only)' })
  @IsOptional()
  @IsString()
  packageName?: string;

  @ApiPropertyOptional({ example: 'Instagram', description: 'App name or iOS Category label' })
  @IsOptional()
  @IsString()
  appName?: string;

  @ApiPropertyOptional({ enum: AppCategory, default: AppCategory.NEUTRAL })
  @IsOptional()
  @IsEnum(AppCategory)
  category?: AppCategory;

  @ApiProperty({ example: 120, description: 'Time spent in minutes' })
  @IsInt()
  @Min(0)
  timeSpentMins!: number;
}

export class BatchSyncScreenTimeDto {
  @ApiPropertyOptional({ example: '2026-08-10' })
  @IsOptional()
  @IsDateString()
  date?: string;

  @ApiPropertyOptional({ enum: DeviceOsDto, default: DeviceOsDto.ANDROID })
  @IsOptional()
  @IsEnum(DeviceOsDto)
  deviceOs?: DeviceOsDto;

  @ApiProperty({ example: 340, description: 'Total screen time in minutes' })
  @IsInt()
  @Min(0)
  totalScreenTimeMins!: number;

  @ApiPropertyOptional({ example: 78.5, description: 'Productivity score (0-100)' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  productivityScore?: number;

  @ApiPropertyOptional({ type: [AppUsageItemDto], default: [] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AppUsageItemDto)
  appUsages?: AppUsageItemDto[];
}