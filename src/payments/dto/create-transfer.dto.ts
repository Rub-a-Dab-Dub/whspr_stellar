import { IsNotEmpty, IsNumber, IsPositive, IsString, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateTransferDto {
  @IsNotEmpty({ message: 'Recipient is required (userId, username, or wallet address)' })
  @IsString()
  recipient: string;

  @IsNumber({ maxDecimalPlaces: 8 })
  @IsPositive()
  @Type(() => Number)
  @Min(0.00000001, { message: 'Amount must be at least 0.00000001' })
  @Max(1000000000, { message: 'Amount cannot exceed 1,000,000,000' })
  amount: number;

  @IsNotEmpty({ message: 'Token address is required' })
  @IsString()
  tokenAddress: string;
}
