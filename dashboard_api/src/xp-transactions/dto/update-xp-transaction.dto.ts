import { PartialType } from '@nestjs/mapped-types';
import { CreateXpTransactionDto } from './create-xp-transaction.dto';
import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsInt, IsNumber, IsOptional, IsString, IsUUID, Min, Max } from 'class-validator';
import { ActionType } from '../entities/xp-transaction.entity';

export class UpdateXPTransactionDto {
  @ApiProperty({ example: 50, description: 'XP adjustment (positive or negative)' })
  @IsInt()
  amount: number;

  @ApiProperty({ example: 'Correcting duplicate award' })
  @IsString()
  reason: string;

  @ApiProperty({ example: 'admin-uuid' })
  @IsUUID()
  adjustedBy: string;
}
