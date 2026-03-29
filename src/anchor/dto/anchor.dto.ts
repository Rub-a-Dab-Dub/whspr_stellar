import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsNumber, IsPositive } from 'class-validator';
import { AnchorTxStatus, AnchorTxType } from '../entities/anchor-transaction.entity';

export class AnchorDto {
  @ApiProperty() id!: string;
  @ApiProperty() name!: string;
  @ApiProperty() homeDomain!: string;
  @ApiProperty() currency!: string;
  @ApiPropertyOptional() country!: string | null;
  @ApiProperty({ type: [String] }) supportedSEPs!: string[];
  @ApiProperty() isActive!: boolean;
  @ApiPropertyOptional() logoUrl!: string | null;
  @ApiPropertyOptional() feeStructure!: Record<string, unknown> | null;
}

export class AnchorRateDto {
  @ApiProperty() anchorId!: string;
  @ApiProperty() anchorName!: string;
  @ApiProperty() fromCurrency!: string;
  @ApiProperty() toCurrency!: string;
  @ApiProperty() rate!: number;
  @ApiProperty() fee!: number;
  @ApiProperty() estimatedReceive!: number;
}

export class InitiateDepositDto {
  @ApiProperty({ example: 'USDC' })
  @IsString()
  assetCode!: string;

  @ApiPropertyOptional({ example: '100.00' })
  @IsOptional()
  @IsString()
  amount?: string;

  @ApiPropertyOptional({ example: 'NGN' })
  @IsOptional()
  @IsString()
  fiatCurrency?: string;
}

export class InitiateWithdrawalDto {
  @ApiProperty({ example: 'USDC' })
  @IsString()
  assetCode!: string;

  @ApiProperty({ example: '50.00' })
  @IsString()
  amount!: string;

  @ApiPropertyOptional({ example: 'NGN' })
  @IsOptional()
  @IsString()
  fiatCurrency?: string;
}

export class AnchorTransactionDto {
  @ApiProperty() id!: string;
  @ApiProperty() userId!: string;
  @ApiProperty() anchorId!: string;
  @ApiProperty({ enum: AnchorTxType }) type!: AnchorTxType;
  @ApiProperty() assetCode!: string;
  @ApiPropertyOptional() amount!: string | null;
  @ApiPropertyOptional() fiatAmount!: string | null;
  @ApiPropertyOptional() fiatCurrency!: string | null;
  @ApiPropertyOptional() stellarTxHash!: string | null;
  @ApiPropertyOptional() anchorTxId!: string | null;
  @ApiProperty({ enum: AnchorTxStatus }) status!: AnchorTxStatus;
  @ApiProperty() createdAt!: Date;
}

export class InitiateTransactionResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty() interactiveUrl!: string;
  @ApiProperty({ enum: AnchorTxStatus }) status!: AnchorTxStatus;
}

export class RatesQueryDto {
  @ApiProperty({ example: 'NGN' })
  @IsString()
  from!: string;

  @ApiProperty({ example: 'USDC' })
  @IsString()
  to!: string;

  @ApiPropertyOptional({ example: 100 })
  @IsOptional()
  @IsNumber()
  @IsPositive()
  amount?: number;
}
