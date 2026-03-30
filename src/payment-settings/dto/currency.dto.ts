import { ApiProperty } from '@nestjs/swagger';
import { Exclude, Expose } from 'class-transformer';
import { DisplayCurrency } from '../entities/currency-preference.entity';

@Exclude()
export class CurrencyRateDto {
  @Expose()
  @ApiProperty({ example: 'USD', description: 'Source currency code' })
  from!: string;

  @Expose()
  @ApiProperty({ example: 'NGN', description: 'Target currency code' })
  to!: string;

  @Expose()
  @ApiProperty({ example: 456, description: 'Exchange rate (1 unit of from = rate units of to)' })
  rate!: number;

  @Expose()
  @ApiProperty({
    example: '2026-03-29T18:30:00.000Z',
    description: 'Timestamp of last rate update',
  })
  lastUpdated?: Date;

  constructor(partial: Partial<CurrencyRateDto>) {
    Object.assign(this, partial);
  }
}

@Exclude()
export class ConversionResultDto {
  @Expose()
  @ApiProperty({ example: 100, description: 'Input amount' })
  amount!: number;

  @Expose()
  @ApiProperty({ example: 'USD', description: 'Source currency' })
  from!: string;

  @Expose()
  @ApiProperty({ example: 'NGN', description: 'Target currency' })
  to!: string;

  @Expose()
  @ApiProperty({ example: 45600, description: 'Converted amount' })
  result!: number;

  @Expose()
  @ApiProperty({ example: 456, description: 'Exchange rate used' })
  rate!: number;

  @Expose()
  @ApiProperty({
    example: '₦45,600.00',
    description: 'Formatted result with currency symbol',
  })
  formatted!: string;

  constructor(partial: Partial<ConversionResultDto>) {
    Object.assign(this, partial);
  }
}

@Exclude()
export class AllRatesResponseDto {
  @Expose()
  @ApiProperty({
    example: { ethereum: { usd: 2500, ngn: 1140000 } },
    description: 'All crypto-to-fiat rates',
  })
  cryptoRates?: { [key: string]: { [key: string]: number } };

  @Expose()
  @ApiProperty({
    example: { usd: { ngn: 456, ghs: 15 }, ngn: { usd: 0.0022, ghs: 0.033 } },
    description: 'All fiat-to-fiat rates',
  })
  fiatRates?: { [key: string]: { [key: string]: number } };

  @Expose()
  @ApiProperty({
    example: '2026-03-29T18:30:00.000Z',
    description: 'Last successful rate update',
  })
  lastUpdated?: Date;

  constructor(partial: Partial<AllRatesResponseDto>) {
    Object.assign(this, partial);
  }
}

@Exclude()
export class CurrencyPreferenceResponseDto {
  @Expose()
  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000', description: 'Preference record ID' })
  id!: string;

  @Expose()
  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440001', description: 'User ID' })
  userId!: string;

  @Expose()
  @ApiProperty({
    enum: ['NGN', 'USD', 'GHS', 'KES', 'ZAR', 'EUR', 'GBP'],
    example: 'NGN',
    description: 'Display currency preference',
  })
  displayCurrency!: DisplayCurrency;

  @Expose()
  @ApiProperty({
    example: '2026-03-29T18:30:00.000Z',
    description: 'When preference was created',
  })
  createdAt!: Date;

  @Expose()
  @ApiProperty({
    example: '2026-03-29T18:30:00.000Z',
    description: 'When preference was last updated',
  })
  updatedAt!: Date;

  constructor(partial: Partial<CurrencyPreferenceResponseDto>) {
    Object.assign(this, partial);
  }
}
