import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsEnum, IsOptional, IsInt, IsPositive, IsDateString, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { PaymentFrequency, RecurringPaymentStatus } from '../entities/recurring-payment.entity';
import { RunStatus } from '../entities/recurring-payment-run.entity';

export class CreateRecurringPaymentDto {
  @ApiProperty({ example: 'GBXXX...', description: 'Stellar recipient address' })
  @IsString()
  recipientAddress!: string;

  @ApiPropertyOptional({ description: 'Token/asset ID (UUID)' })
  @IsOptional()
  @IsString()
  tokenId?: string;

  @ApiProperty({ example: '10.0000000' })
  @IsString()
  amount!: string;

  @ApiProperty({ enum: PaymentFrequency })
  @IsEnum(PaymentFrequency)
  frequency!: PaymentFrequency;

  @ApiProperty({ example: '2026-04-01T00:00:00.000Z', description: 'First run date/time' })
  @IsDateString()
  startAt!: string;

  @ApiPropertyOptional({ example: 12, description: 'Max number of runs (null = unlimited)' })
  @IsOptional()
  @IsInt()
  @IsPositive()
  @Type(() => Number)
  maxRuns?: number;
}

export class RecurringPaymentDto {
  @ApiProperty() id!: string;
  @ApiProperty() senderId!: string;
  @ApiProperty() recipientAddress!: string;
  @ApiPropertyOptional() tokenId!: string | null;
  @ApiProperty() amount!: string;
  @ApiProperty({ enum: PaymentFrequency }) frequency!: PaymentFrequency;
  @ApiProperty() nextRunAt!: Date;
  @ApiPropertyOptional() lastRunAt!: Date | null;
  @ApiProperty() totalRuns!: number;
  @ApiPropertyOptional() maxRuns!: number | null;
  @ApiProperty({ enum: RecurringPaymentStatus }) status!: RecurringPaymentStatus;
  @ApiProperty() createdAt!: Date;
}

export class RecurringPaymentRunDto {
  @ApiProperty() id!: string;
  @ApiProperty() recurringPaymentId!: string;
  @ApiPropertyOptional() txHash!: string | null;
  @ApiProperty({ enum: RunStatus }) status!: RunStatus;
  @ApiProperty() amount!: string;
  @ApiPropertyOptional() errorMessage!: string | null;
  @ApiProperty() executedAt!: Date;
}
