import { IsEnum, IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator';
import { Platform } from '../entities/push-subscription.entity';

export class RegisterDeviceDto {
  @IsUUID()
  userId: string;

  @IsString()
  @IsNotEmpty()
  deviceToken: string;

  @IsEnum(Platform)
  platform: Platform;
}

export class UnregisterDeviceDto {
  @IsUUID()
  userId: string;

  @IsString()
  @IsNotEmpty()
  deviceToken: string;
}

export class SendToUserDto {
  @IsUUID()
  userId: string;

  @IsString()
  @IsNotEmpty()
  title: string;

  @IsString()
  @IsNotEmpty()
  body: string;

  @IsOptional()
  data?: Record<string, string>;

  @IsOptional()
  @IsString()
  imageUrl?: string;

  @IsOptional()
  @IsString()
  notificationType?: string;
}

export class SendToTopicDto {
  @IsString()
  @IsNotEmpty()
  topic: string;

  @IsString()
  @IsNotEmpty()
  title: string;

  @IsString()
  @IsNotEmpty()
  body: string;

  @IsOptional()
  data?: Record<string, string>;

  @IsOptional()
  @IsString()
  imageUrl?: string;
}
