import { IsUUID, IsEnum, IsOptional, IsString, IsNumber, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  BlockchainTransactionType,
  BlockchainTransactionStatus,
} from '../entities/blockchain-transaction.entity';

export class ListBlockchainTransactionsQueryDto {
  @ApiPropertyOptional({ description: 'Page number', example: 1 })
  @IsOptional()
  @Type(() => Number)
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ description: 'Items per page', example: 10 })
  @IsOptional()
  @Type(() => Number)
  @Min(1)
  @Max(100)
  limit?: number = 10;

  @ApiPropertyOptional({
    description: 'Filter by transaction type',
    enum: BlockchainTransactionType,
  })
  @IsOptional()
  @IsEnum(BlockchainTransactionType)
  type?: BlockchainTransactionType;

  @ApiPropertyOptional({
    description: 'Filter by transaction status',
    enum: BlockchainTransactionStatus,
  })
  @IsOptional()
  @IsEnum(BlockchainTransactionStatus)
  status?: BlockchainTransactionStatus;
}

export class CreateBlockchainTransactionDto {
  @IsUUID()
  userId!: string;

  @IsEnum(BlockchainTransactionType)
  type!: BlockchainTransactionType;

  @IsString()
  fromAddress!: string;

  @IsOptional()
  @IsString()
  toAddress?: string;

  @IsString()
  amountUsdc!: string;

  @IsString()
  referenceId!: string;
}

export class UpdateBlockchainTransactionStatusDto {
  @IsEnum(BlockchainTransactionStatus)
  status!: BlockchainTransactionStatus;

  @IsOptional()
  @IsString()
  txHash?: string;

  @IsOptional()
  @IsNumber()
  ledger?: number;

  @IsOptional()
  @IsString()
  errorMessage?: string;

  @IsOptional()
  @IsNumber()
  feeStroops?: number;
}
