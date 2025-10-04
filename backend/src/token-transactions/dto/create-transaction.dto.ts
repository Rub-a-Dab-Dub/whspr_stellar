import { IsUUID, IsString, IsOptional, IsNumberString } from 'class-validator';

export class CreateTransactionDto {
  @IsString()
  traceId!: string;

  @IsOptional()
  @IsUUID()
  senderId?: string;

  @IsOptional()
  @IsUUID()
  receiverId?: string;

  @IsNumberString()
  amount!: string; // numeric string

  @IsOptional()
  @IsString()
  tokenSymbol?: string;

  @IsOptional()
  meta?: Record<string, any>;
}
