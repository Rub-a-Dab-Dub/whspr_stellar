import { ApiProperty } from '@nestjs/swagger';
import { BulkPaymentStatus } from '../enums/bulk-payment-status.enum';

export class BulkPaymentDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  label: string;

  @ApiProperty()
  csvKey: string;

  @ApiProperty()
  totalRows: number;

  @ApiProperty()
  successCount: number;

  @ApiProperty()
  failureCount: number;

  @ApiProperty()
  totalAmountUsdc: string;

  @ApiProperty({ enum: BulkPaymentStatus })
  status: BulkPaymentStatus;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  completedAt?: Date;

  @ApiProperty()
  progress: number; // derived: successCount / totalRows
}

export class BulkPaymentRowDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  rowNumber: number;

  @ApiProperty()
  toUsername: string;

  @ApiProperty()
  amountUsdc: string;

  @ApiProperty()
  note?: string;

  // status, failureReason, txId, processedAt from entity
}

export class PaginatedBulkPaymentsDto {
  @ApiProperty()
  data: BulkPaymentDto[];

  @ApiProperty()
  total: number;

  @ApiProperty()
  page: number;

  @ApiProperty()
  limit: number;
}

