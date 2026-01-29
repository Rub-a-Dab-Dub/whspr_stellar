import {
  IsString,
  IsNotEmpty,
  IsEnum,
  IsOptional,
  IsArray,
  MaxLength,
  MinLength,
} from 'class-validator';
import { DisputeReason } from '../entities/transfer-dispute.entity';

export class CreateDisputeDto {
  @IsEnum(DisputeReason)
  @IsNotEmpty({ message: 'Dispute reason is required' })
  reason: DisputeReason;

  @IsString()
  @IsNotEmpty({ message: 'Description is required' })
  @MinLength(20, { message: 'Description must be at least 20 characters' })
  @MaxLength(2000, { message: 'Description cannot exceed 2000 characters' })
  description: string;

  @IsArray()
  @IsOptional()
  @IsString({ each: true })
  evidence?: string[];
}
