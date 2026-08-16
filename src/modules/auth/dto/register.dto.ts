/* eslint-disable @typescript-eslint/no-unsafe-return */
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsDate,
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

export enum Gender {
  MALE = 'MALE',
  FEMALE = 'FEMALE',
}

export enum ActivityLevel {
  SEDENTARY = 'SEDENTARY',
  LIGHTLY_ACTIVE = 'LIGHTLY_ACTIVE',
  MODERATELY_ACTIVE = 'MODERATELY_ACTIVE',
  VERY_ACTIVE = 'VERY_ACTIVE',
}

export class RegisterDto {
  @ApiProperty({ example: 'John Doe' })
  @IsNotEmpty()
  @IsString()
  name!: string;

  @ApiPropertyOptional({ example: 'john@example.com' })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiProperty({ example: 'strongPassword123', minLength: 6 })
  @IsNotEmpty()
  @IsString()
  password!: string;

  @ApiPropertyOptional({ example: '+8801700000000' })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional({ example: 'hello there!' })
  @IsOptional()
  @IsString()
  bio?: string;

  // --- Location & Timezone (Automated via Mobile Client) ---

  @ApiPropertyOptional({ example: 'Asia/Dhaka', default: 'Asia/Dhaka' })
  @IsOptional()
  @IsString()
  timezone?: string = 'Asia/Dhaka';

  @ApiPropertyOptional({ example: 'Dhaka' })
  @IsOptional()
  @IsString()
  district?: string;

  @ApiPropertyOptional({ example: 'Dhanmondi' })
  @IsOptional()
  @IsString()
  upazila?: string;

  // --- Physical Health Metrics ---

  @ApiPropertyOptional({ example: '1998-05-15T00:00:00.000Z' })
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  dateOfBirth?: Date;

  @ApiPropertyOptional({ enum: Gender, example: Gender.MALE })
  @IsOptional()
  @IsEnum(Gender)
  gender?: Gender;

  @ApiPropertyOptional({ example: 1.75, description: 'Height in meters' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0.5)
  height?: number;

  @ApiPropertyOptional({ example: 70.5, description: 'Weight in kg' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  weight?: number;

  @ApiPropertyOptional({ enum: ActivityLevel, example: ActivityLevel.SEDENTARY })
  @IsOptional()
  @IsEnum(ActivityLevel)
  activityLevel?: ActivityLevel;

  // --- Optional Modular Feature Flags ---

  @ApiPropertyOptional({ example: false, default: false })
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  enableIslamicFeatures?: boolean = false;

  @ApiPropertyOptional({ example: false, default: false })
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  enableMailAssistance?: boolean = false;

  @ApiPropertyOptional({ example: true, default: true })
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  enableFinanceTracker?: boolean = true;

  @ApiPropertyOptional({ example: true, default: true })
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  enableHealthTracking?: boolean = true;

  @ApiPropertyOptional({ example: false, default: false })
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  enableScreenTimeTracking?: boolean = false;

  @ApiPropertyOptional({ example: true, default: true })
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  enableAiBriefings?: boolean = true;

  // --- Terms & Profile Flags ---

  @ApiProperty({ example: true })
  @IsNotEmpty()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  is_agreed_to_terms_and_policy!: boolean;

  @ApiPropertyOptional({ type: 'string', format: 'binary', required: false })
  @IsOptional()
  image?: any;
}