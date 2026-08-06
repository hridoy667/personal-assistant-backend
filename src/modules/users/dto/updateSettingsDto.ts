import { IsBoolean, IsOptional } from 'class-validator';

export class UpdateSettingsDto {
  @IsOptional()
  @IsBoolean()
  isNotificationOn?: boolean;

  @IsOptional()
  @IsBoolean()
  securityAlert?: boolean;

  @IsOptional()
  @IsBoolean()
  emailNotification?: boolean;
}