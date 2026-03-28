import { ApiProperty } from '@nestjs/swagger';
import {
  BlockchainTransactionType,
  BlockchainTransactionStatus,
} from '../entities/blockchain-transaction.entity';

export class BlockchainTransactionResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ format: 'uuid' })
  userId!: string;

  @ApiProperty({ enum: BlockchainTransactionType })
  type!: BlockchainTransactionType;

  @ApiProperty({ nullable: true })
  txHash!: string | null;

  @ApiProperty({ enum: BlockchainTransactionStatus })
  status!: BlockchainTransactionStatus;

  @ApiProperty()
  fromAddress!: string;

  @ApiProperty({ nullable: true })
  toAddress!: string | null;

  @ApiProperty()
  amountUsdc!: string;

  @ApiProperty({ nullable: true })
  feeStroops!: string | null;

  @ApiProperty({ nullable: true })
  ledger!: number | null;

  @ApiProperty({ nullable: true })
  errorMessage!: string | null;

  @ApiProperty()
  referenceId!: string;

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty({ nullable: true })
  confirmedAt!: Date | null;

  @ApiProperty()
  updatedAt!: Date;
}

export class BlockchainTransactionListResponseDto {
  @ApiProperty({ type: [BlockchainTransactionResponseDto] })
  data!: BlockchainTransactionResponseDto[];

  @ApiProperty()
  total!: number;

  @ApiProperty()
  page!: number;

  @ApiProperty()
  limit!: number;

  @ApiProperty()
  totalPages!: number;
}
