import {
  IsArray,
  IsString,
  IsNotEmpty,
  IsNumber,
  IsPositive,
  IsOptional,
  MaxLength,
  IsUUID,
  ValidateNested,
  ArrayMinSize,
  ArrayMaxSize,
  Min,
  Max,
} from 'class-validator';
import { Type } from 'class-transformer';

export class BulkTransferRecipientDto {
  @IsUUID()
  @IsNotEmpty({ message: 'Recipient ID is required' })
  recipientId: string;

  @IsNumber(
    { maxDecimalPlaces: 8 },
    { message: 'Amount must be a valid number with up to 8 decimal places' },
  )
  @IsPositive({ message: 'Amount must be greater than zero' })
  @Type(() => Number)
  @Min(0.00000001, { message: 'Amount must be at least 0.00000001' })
  @Max(1000000000, { message: 'Amount cannot exceed 1,000,000,000' })
  amount: number;

  @IsString()
  @IsOptional()
  @MaxLength(500, { message: 'Note cannot exceed 500 characters' })
  note?: string;
}

export class CreateBulkTransferDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BulkTransferRecipientDto)
  @ArrayMinSize(2, { message: 'Bulk transfer must have at least 2 recipients' })
  @ArrayMaxSize(100, { message: 'Bulk transfer cannot exceed 100 recipients' })
  recipients: BulkTransferRecipientDto[];

  @IsString()
  @IsOptional()
  @MaxLength(28, { message: 'Memo cannot exceed 28 characters' })
  memo?: string;

  @IsString()
  @IsOptional()
  blockchainNetwork?: string;
}
