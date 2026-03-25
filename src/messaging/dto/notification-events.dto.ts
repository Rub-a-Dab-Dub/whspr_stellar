import { IsString, IsOptional, IsEnum } from 'class-validator';

export enum NotificationType {
  MESSAGE = 'message',
  FRIEND_REQUEST = 'friend_request',
  TRANSFER = 'transfer',
  SYSTEM = 'system',
}

export class NotificationDto {
  @IsString()
  id: string;

  @IsEnum(NotificationType)
  type: NotificationType;

  @IsString()
  title: string;

  @IsString()
  body: string;

  @IsOptional()
  data?: Record<string, unknown>;
}

export class TransferUpdateDto {
  @IsString()
  transferId: string;

  @IsString()
  status: string;

  @IsOptional()
  @IsString()
  amount?: string;

  @IsOptional()
  @IsString()
  currency?: string;

  @IsOptional()
  @IsString()
  txHash?: string;
}
