/* eslint-disable @typescript-eslint/no-unsafe-return */
import { ApiProperty } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsArray,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
} from 'class-validator';
import { UserRole, FarmType } from './register.dto'; // আপনার ফাইল পাথ অনুযায়ী ইম্পোর্ট করুন

export class CompleteProfileDto {
  @ApiProperty({ enum: UserRole, example: 'USER' })
  @IsNotEmpty()
  @IsEnum(UserRole)
  type!: UserRole;

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

  @ApiProperty({ example: 'My Organic Shop', required: false })
  @IsOptional()
  @IsString()
  shopName?: string;

  @ApiProperty({ example: 'Fresh organic goods directly from farm', required: false })
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
    required: false,
  })
  @Transform(({ value }) => {
    if (Array.isArray(value)) return value;
    return value ? [value] : [];
  })
  farmTypes?: FarmType[];

  @ApiProperty({ example: 'Farm location details', required: false })
  @IsOptional()
  @IsString()
  location?: string;

  @ApiProperty({ example: 'House 12, Road 5, Dhaka', required: false })
  @IsOptional()
  @IsString()
  shippingAddress?: string;

  @ApiProperty({ example: 'Farmer short biography', required: false })
  @IsOptional()
  @IsString()
  bio?: string;

  @ApiProperty({ type: 'string', format: 'binary', required: false })
  @IsOptional()
  image?: any;
}