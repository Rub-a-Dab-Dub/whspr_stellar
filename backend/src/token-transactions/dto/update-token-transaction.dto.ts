
import { IsOptional, IsEnum } from 'class-validator';
import { TransactionStatus } from '../entities/transaction.entity';
export class UpdateTransactionDto {
  @IsOptional()
  @IsEnum(TransactionStatus)
  status?: TransactionStatus;

  @IsOptional()
  meta?: Record<string, any>;
}