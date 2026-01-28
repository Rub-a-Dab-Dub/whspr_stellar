import { IsEnum, IsBoolean, IsOptional, IsObject } from 'class-validator';
import { NotificationType } from '../enums/notification-type.enum';
import { NotificationChannel } from '../enums/notification-channel.enum';

export class UpdateNotificationPreferenceDto {
  @IsEnum(NotificationType)
  type!: NotificationType;

  @IsEnum(NotificationChannel)
  channel!: NotificationChannel;

  @IsBoolean()
  enabled!: boolean;

  @IsOptional()
  @IsObject()
  settings?: Record<string, any>;
}

export class BulkUpdatePreferencesDto {
  @IsOptional()
  @IsObject()
  preferences?: Record<string, Record<string, boolean>>;
}