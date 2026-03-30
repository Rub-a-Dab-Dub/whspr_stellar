import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsNumber, IsPositive, IsString, IsOptional } from 'class-validator';
import { DisplayCurrency } from '../entities/currency-preference.entity';

export class SetDisplayCurrencyDto {
  @ApiProperty({
    enum: ['NGN', 'USD', 'GHS', 'KES', 'ZAR', 'EUR', 'GBP'],
    example: 'NGN',
    description: 'Preferred display currency for this user',
  })
  @IsEnum(DisplayCurrency)
  displayCurrency!: DisplayCurrency;
}

export class ConvertCurrencyQueryDto {
  @ApiProperty({
    example: 'USD',
    description: 'Source currency code',
  })
  @IsString()
  from!: string;

  @ApiProperty({
    example: 'NGN',
    description: 'Target currency code',
  })
  @IsString()
  to!: string;

  @ApiProperty({
    example: 100,
    description: 'Amount to convert',
  })
  @IsNumber()
  @IsPositive()
  amount!: number;
}

export class BatchConvertDto {
  @ApiProperty({
    example: [
      { amount: 100, from: 'USD', to: 'NGN' },
      { amount: 50, from: 'EUR', to: 'GHS' },
    ],
    description: 'Array of conversions to perform',
  })
  conversions!: Array<{
    amount: number;
    from: string;
    to: string;
  }>;
}
