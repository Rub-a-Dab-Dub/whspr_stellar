import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { TransactionStatus, TransactionType } from '../entities/transaction.entity';

export class TransactionResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  txHash!: string;

  @ApiProperty()
  fromAddress!: string;

  @ApiProperty()
  toAddress!: string;

  @ApiProperty()
  tokenId!: string;

  @ApiProperty({ example: '12.500000000000000000' })
  amount!: string;

  @ApiProperty({ example: '0.000010000000000000' })
  fee!: string;

  @ApiProperty({ enum: TransactionStatus })
  status!: TransactionStatus;

  @ApiProperty({ enum: TransactionType })
  type!: TransactionType;

  @ApiPropertyOptional()
  conversationId!: string | null;

  @ApiPropertyOptional()
  messageId!: string | null;

  @ApiProperty()
  network!: string;

  @ApiPropertyOptional()
  ledger!: string | null;

  @ApiPropertyOptional()
  failureReason!: string | null;

  @ApiPropertyOptional()
  confirmedAt!: Date | null;

  @ApiProperty()
  createdAt!: Date;
}

export class TransactionListResponseDto {
  @ApiProperty({ type: [TransactionResponseDto] })
  items!: TransactionResponseDto[];

  @ApiProperty()
  total!: number;

  @ApiProperty()
  page!: number;

  @ApiProperty()
  limit!: number;
}
