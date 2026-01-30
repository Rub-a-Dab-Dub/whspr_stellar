import {
  IsString,
  IsNotEmpty,
  IsEnum,
  IsOptional,
  IsObject,
  IsDateString,
  IsUrl,
  MaxLength,
} from 'class-validator';
import { NotificationType, NotificationPriority } from '../enums/notification-type.enum';

export class CreateNotificationDto {
  @IsString()
  @IsNotEmpty()
  recipientId: string;

  @IsString()
  @IsOptional()
  senderId?: string;

  @IsEnum(NotificationType)
  type: NotificationType;

  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  title: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(1000)
  message: string;

  @IsObject()
  @IsOptional()
  data?: Record<string, any>;

  @IsEnum(NotificationPriority)
  @IsOptional()
  priority?: NotificationPriority;

  @IsUrl()
  @IsOptional()
  actionUrl?: string;

  @IsUrl()
  @IsOptional()
  imageUrl?: string;

  @IsDateString()
  @IsOptional()
  expiresAt?: string;
}