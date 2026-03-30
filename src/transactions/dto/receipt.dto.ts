import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsEnum, IsOptional, IsString } from 'class-validator';

export enum ExportTransactionType {
  TRANSFER = 'TRANSFER',
  TIP = 'TIP',
  SPLIT = 'SPLIT',
  TREASURY = 'TREASURY',
}

export class ExportTransactionsDto {
  @ApiPropertyOptional({ description: 'Inclusive export start date (ISO-8601)' })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional({ description: 'Inclusive export end date (ISO-8601)' })
  @IsOptional()
  @IsDateString()
  endDate?: string;

  @ApiPropertyOptional({ description: 'Token identifier filter', example: 'XLM' })
  @IsOptional()
  @IsString()
  token?: string;

  @ApiPropertyOptional({ enum: ExportTransactionType })
  @IsOptional()
  @IsEnum(ExportTransactionType)
  type?: ExportTransactionType;
}

export class ReceiptUrlResponseDto {
  @ApiProperty()
  transactionId!: string;

  @ApiProperty()
  url!: string;

  @ApiProperty({ description: 'ISO timestamp when the URL expires' })
  expiresAt!: string;
}

export class ExportJobResponseDto {
  @ApiProperty()
  jobId!: string;

  @ApiProperty({ example: 'queued' })
  status!: string;
}

export class ExportStatusResponseDto {
  @ApiProperty()
  jobId!: string;

  @ApiProperty({ example: 'completed' })
  status!: string;

  @ApiPropertyOptional({ description: 'Signed download URL when export is completed' })
  downloadUrl?: string;

  @ApiPropertyOptional({ description: 'ISO timestamp when signed URL expires' })
  expiresAt?: string;

  @ApiPropertyOptional()
  error?: string;
}
