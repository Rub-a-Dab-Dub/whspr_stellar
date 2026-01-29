import {
  IsString,
  IsNotEmpty,
  IsNumber,
  IsPositive,
  IsOptional,
  MaxLength,
  IsUUID,
  IsDate,
  IsBoolean,
  IsEnum,
  Min,
  Max,
  ValidateIf,
} from 'class-validator';
import { Type } from 'class-transformer';
import { RecurrenceFrequency } from '../entities/scheduled-transfer.entity';

export class CreateScheduledTransferDto {
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

  @IsDate({ message: 'Scheduled date must be a valid date' })
  @Type(() => Date)
  scheduledDate: Date;

  @IsBoolean()
  @IsOptional()
  isRecurring?: boolean;

  @ValidateIf((o) => o.isRecurring === true)
  @IsEnum(RecurrenceFrequency)
  recurrenceFrequency?: RecurrenceFrequency;

  @ValidateIf((o) => o.isRecurring === true)
  @IsDate({ message: 'Recurrence end date must be a valid date' })
  @Type(() => Date)
  @IsOptional()
  recurrenceEndDate?: Date;

  @ValidateIf((o) => o.isRecurring === true)
  @IsNumber()
  @IsPositive()
  @Type(() => Number)
  @IsOptional()
  maxExecutions?: number;

  @IsString()
  @IsOptional()
  @MaxLength(28, { message: 'Memo cannot exceed 28 characters' })
  memo?: string;

  @IsString()
  @IsOptional()
  @MaxLength(500, { message: 'Note cannot exceed 500 characters' })
  note?: string;

  @IsString()
  @IsOptional()
  blockchainNetwork?: string;
}
