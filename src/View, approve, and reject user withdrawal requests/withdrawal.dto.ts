import {
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsString,
  IsUUID,
  Min,
  IsEthereumAddress,
  IsOptional,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ChainType } from '../entities/withdrawal-request.entity';
import { Type } from 'class-transformer';

export class CreateWithdrawalRequestDto {
  @ApiProperty({ example: 'user-uuid-here' })
  @IsUUID()
  userId: string;

  @ApiProperty({ example: 'john_doe' })
  @IsString()
  @IsNotEmpty()
  username: string;

  @ApiProperty({ example: '0xAbc123...' })
  @IsString()
  @IsNotEmpty()
  walletAddress: string;

  @ApiProperty({ example: 500.5 })
  @IsNumber()
  @Min(0.000001)
  @Type(() => Number)
  amount: number;

  @ApiProperty({ enum: ChainType })
  @IsEnum(ChainType)
  chain: ChainType;
}

export class RejectWithdrawalDto {
  @ApiProperty({ example: 'Suspicious wallet address flagged by compliance.' })
  @IsString()
  @IsNotEmpty()
  reason: string;
}

export class WithdrawalRequestFilterDto {
  @ApiPropertyOptional({ enum: ['pending', 'approved', 'rejected', 'queued', 'completed'] })
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  userId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  chain?: string;

  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  page?: number = 1;

  @ApiPropertyOptional({ example: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  limit?: number = 20;
}
