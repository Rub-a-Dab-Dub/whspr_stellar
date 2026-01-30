import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsObject,
} from 'class-validator';

export class CreatePushSubscriptionDto {
  @IsString()
  @IsNotEmpty()
  endpoint: string;

  @IsString()
  @IsNotEmpty()
  p256dhKey: string;

  @IsString()
  @IsNotEmpty()
  authKey: string;

  @IsString()
  @IsOptional()
  deviceType?: string;

  @IsString()
  @IsOptional()
  deviceName?: string;

  @IsString()
  @IsOptional()
  userAgent?: string;
}

export class PushNotificationDto {
  @IsString()
  @IsNotEmpty()
  title: string;

  @IsString()
  @IsNotEmpty()
  body: string;

  @IsString()
  @IsOptional()
  icon?: string;

  @IsString()
  @IsOptional()
  badge?: string;

  @IsString()
  @IsOptional()
  image?: string;

  @IsString()
  @IsOptional()
  tag?: string;

  @IsString()
  @IsOptional()
  url?: string;

  @IsObject()
  @IsOptional()
  data?: Record<string, any>;
}