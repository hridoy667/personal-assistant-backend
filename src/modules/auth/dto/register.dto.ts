/* eslint-disable @typescript-eslint/no-unsafe-return */
import { ApiProperty } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
} from 'class-validator';

export enum UserRole {
  USER = 'USER',
  FARMER = 'FARMER',
  ADMIN = 'ADMIN',
}

export enum FarmType {
  RICE = 'RICE',
  VEGETABLE = 'VEGETABLE',
  FISH = 'FISH',
  MEAT = 'MEAT',
  POULTRY = 'POULTRY',
  DAIRY = 'DAIRY',
  EGGS = 'EGGS',
  FRUIT = 'FRUIT',
  SHRIMP_CRAB = 'SHRIMP_CRAB',
  FLOWER = 'FLOWER',
  NURSERY = 'NURSERY',
  GRAINS_PULSES = 'GRAINS_PULSES',
  SPICES = 'SPICES',
  HONEY = 'HONEY',
  MUSHROOM = 'MUSHROOM',
  AGRO_PROCESSING = 'AGRO_PROCESSING',
}

export class RegisterDto {
  @ApiProperty({ example: 'John' })
  @IsNotEmpty()
  @IsString()
  name!: string;

  @ApiProperty({ example: 'john@example.com' })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiProperty({ example: 'hello there!' })
  @IsOptional()
  @IsString()
  bio?: string;

  @ApiProperty({ example: 'strongPassword123', minLength: 6 })
  @IsNotEmpty()
  @IsString()
  password!: string;

  @ApiProperty({ example: '+8801700000000' })
  @IsNotEmpty()
  @IsString()
  phone!: string;

  @ApiProperty({ example: 'Dhaka' })
  @IsNotEmpty()
  @IsString()
  district!: string;

  @ApiProperty({ example: 'Dhaka' })
  @IsOptional()
  @IsString()
  upazila?: string;

  @ApiProperty({ required: false, type: Number })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  latitude?: number;

  @ApiProperty({ required: false, type: Number })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  longitude?: number;

  @ApiProperty({ enum: UserRole, example: 'USER' })
  @IsNotEmpty()
  @IsEnum(UserRole)
  type!: UserRole;

  @IsOptional()
  @IsString()
  shopName?: string;

  @IsOptional()
  @IsString()
  shopDescription?: string;

  @IsOptional()
  @IsArray()
  @IsEnum(FarmType, { each: true })
  @ApiProperty({
    example: ['VEGETABLE', 'FRUIT'],
    enum: FarmType,
    isArray: true,
  })
  @Transform(({ value }) => {
    if (Array.isArray(value)) return value;
    return value ? [value] : [];
  })
  farmTypes?: FarmType[];

  @IsOptional()
  @IsString()
  location?: string;

  @IsNotEmpty()
  @IsBoolean()
  is_agreed_to_terms_and_policy!:boolean

  @IsOptional()
  @IsString()
  shippingAddress?: string;

  @ApiProperty({ type: 'string', format: 'binary', required: false })
  @IsOptional()
  image?: any;
}
