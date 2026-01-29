import {
  IsString,
  IsEnum,
  IsBoolean,
  IsOptional,
  IsArray,
  Matches,
} from 'class-validator';
import { NotificationType, NotificationChannel } from '../enums/notification-type.enum';

export class UpdateNotificationPreferenceDto {
  @IsEnum(NotificationType)
  type: NotificationType;

  @IsEnum(NotificationChannel)
  channel: NotificationChannel;

  @IsBoolean()
  isEnabled: boolean;

  @IsString()
  @IsOptional()
  @Matches(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/, {
    message: 'quietHoursStart must be in HH:MM format',
  })
  quietHoursStart?: string;

  @IsString()
  @IsOptional()
  @Matches(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/, {
    message: 'quietHoursEnd must be in HH:MM format',
  })
  quietHoursEnd?: string;
}

export class BulkUpdatePreferencesDto {
  @IsArray()
  preferences: UpdateNotificationPreferenceDto[];
}

export class MuteUserDto {
  @IsString()
  userId: string;
}

export class MuteRoomDto {
  @IsString()
  roomId: string;
}

export class GetNotificationsDto {
  @IsOptional()
  @IsString()
  type?: NotificationType;

  @IsOptional()
  @IsBoolean()
  unreadOnly?: boolean;

  @IsOptional()
  @IsString()
  page?: string;

  @IsOptional()
  @IsString()
  limit?: string;
}