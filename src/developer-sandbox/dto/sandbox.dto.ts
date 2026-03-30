import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNumberString, IsOptional } from 'class-validator';
import { SandboxTestWallet } from '../entities/sandbox-environment.entity';
import {
  SandboxTransactionStatus,
  SandboxTransactionType,
} from '../entities/sandbox-transaction.entity';

export class FundSandboxWalletDto {
  @ApiPropertyOptional({
    description: 'Amount to simulate as funded amount from Friendbot',
    default: '10000.0000000',
  })
  @IsOptional()
  @IsNumberString()
  amount?: string;
}

export class SandboxEnvironmentResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  userId!: string;

  @ApiProperty()
  apiKeyId!: string;

  @ApiProperty({ type: 'array' })
  testWallets!: SandboxTestWallet[];

  @ApiProperty()
  createdAt!: Date;
}

export class SandboxTransactionResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  environmentId!: string;

  @ApiProperty()
  walletAddress!: string;

  @ApiProperty()
  asset!: string;

  @ApiProperty()
  amount!: string;

  @ApiProperty({ enum: SandboxTransactionType })
  type!: SandboxTransactionType;

  @ApiProperty({ enum: SandboxTransactionStatus })
  status!: SandboxTransactionStatus;

  @ApiProperty()
  isSandbox!: boolean;

  @ApiProperty()
  network!: string;

  @ApiPropertyOptional()
  friendbotTxHash!: string | null;

  @ApiPropertyOptional()
  errorMessage!: string | null;

  @ApiProperty()
  createdAt!: Date;
}
