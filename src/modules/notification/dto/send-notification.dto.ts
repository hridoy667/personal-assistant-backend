import { IsNotEmpty, IsString, IsArray, IsOptional, ValidateIf } from 'class-validator';

export class SendNotificationDto {
  @IsNotEmpty()
  @ValidateIf((o) => typeof o.userIds === 'string' || Array.isArray(o.userIds))
  userIds!: string | string[];

  @IsNotEmpty()
  @IsString()
  title!: string;

  @IsNotEmpty()
  @IsString()
  body!: string;
}