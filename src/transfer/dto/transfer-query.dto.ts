import { IsOptional, IsEnum, IsString, IsInt, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';
import { TransferStatus, TransferType } from '../entities/transfer.entity';

export class TransferQueryDto {
  @IsOptional()
  @IsEnum(TransferStatus)
  status?: TransferStatus;

  @IsOptional()
  @IsEnum(TransferType)
  type?: TransferType;

  @IsOptional()
  @IsString()
  recipientId?: string;

  @IsOptional()
  @IsString()
  senderId?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  @Type(() => Number)
  limit?: number = 20;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Type(() => Number)
  offset?: number = 0;
}
