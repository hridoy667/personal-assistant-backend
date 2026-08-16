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

export class CompleteProfileDto {

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