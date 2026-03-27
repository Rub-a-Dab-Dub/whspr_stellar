import { IsString, IsOptional, IsEnum } from 'class-validator';

export enum NotificationType {
  NEW_MESSAGE = 'NEW_MESSAGE',
  TRANSFER_RECEIVED = 'TRANSFER_RECEIVED',
  GROUP_INVITE = 'GROUP_INVITE',
  CONTACT_REQUEST = 'CONTACT_REQUEST',
  PROPOSAL_VOTE = 'PROPOSAL_VOTE',
  TRANSACTION_CONFIRMED = 'TRANSACTION_CONFIRMED',
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

  @IsOptional()
  @IsString()
  failureReason?: string;
}
