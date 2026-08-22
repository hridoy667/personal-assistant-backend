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
  Matches,
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

export enum PersonalityType {
  // Analysts
  INTJ_ARCHITECT = 'INTJ_ARCHITECT',
  INTP_LOGICIAN = 'INTP_LOGICIAN',
  ENTJ_COMMANDER = 'ENTJ_COMMANDER',
  ENTP_DEBATER = 'ENTP_DEBATER',

  // Diplomats
  INFJ_ADVOCATE = 'INFJ_ADVOCATE',
  INFP_MEDIATOR = 'INFP_MEDIATOR',
  ENFJ_PROTAGONIST = 'ENFJ_PROTAGONIST',
  ENFP_CAMPAIGNER = 'ENFP_CAMPAIGNER',

  // Sentinels
  ISTJ_LOGISTICIAN = 'ISTJ_LOGISTICIAN',
  ISFJ_DEFENDER = 'ISFJ_DEFENDER',
  ESTJ_EXECUTIVE = 'ESTJ_EXECUTIVE',
  ESFJ_CONSUL = 'ESFJ_CONSUL',

  // Explorers
  ISTP_VIRTUSOA = 'ISTP_VIRTUSOA',
  ISFP_ADVENTURER = 'ISFP_ADVENTURER',
  ESTP_ENTREPRENEUR = 'ESTP_ENTREPRENEUR',
  ESFP_ENTERTAINER = 'ESFP_ENTERTAINER',
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

  // --- Routine & Personality ---

  @ApiPropertyOptional({ example: '06:00', default: '06:00', description: 'HH:mm format' })
  @IsOptional()
  @IsString()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, {
    message: 'defaultWakeTime must be in HH:mm format (e.g. 06:00)',
  })
  defaultWakeTime?: string = '06:00';

  @ApiPropertyOptional({ example: '23:00', default: '23:00', description: 'HH:mm format' })
  @IsOptional()
  @IsString()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, {
    message: 'defaultSleepTime must be in HH:mm format (e.g. 23:00)',
  })
  defaultSleepTime?: string = '23:00';

  @ApiPropertyOptional({ enum: PersonalityType, example: PersonalityType.INTJ_ARCHITECT })
  @IsOptional()
  @Transform(({ value }) => (value === 'null' || value === '' ? undefined : value))
  @IsEnum(PersonalityType)
  personalityType?: PersonalityType;

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