import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsInt, IsNumber, IsOptional, IsString, IsUUID, Min, Max } from 'class-validator';
import { ActionType } from '../entities/xp-transaction.entity';

export class CreateXPTransactionDto {
  @ApiProperty({ example: 'a1b2c3d4-e5f6-g7h8-i9j0-k1l2m3n4o5p6' })
  @IsUUID()
  userId: string;

  @ApiProperty({ enum: ActionType, example: ActionType.MANUAL_AWARD })
  @IsEnum(ActionType)
  actionType: ActionType;

  @ApiProperty({ example: 100, description: 'Base XP amount' })
  @IsInt()
  @Min(1)
  amount: number;

  @ApiProperty({ example: 1.5, description: 'Multiplier (1.0-10.0)', required: false })
  @IsOptional()
  @IsNumber()
  @Min(0.1)
  @Max(10.0)
  multiplier?: number;

  @ApiProperty({ example: 'Community event participation', required: false })
  @IsOptional()
  @IsString()
  reason?: string;

  @ApiProperty({ example: 'tx_abc123', required: false })
  @IsOptional()
  @IsString()
  transactionId?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  metadata?: Record<string, any>;
}
