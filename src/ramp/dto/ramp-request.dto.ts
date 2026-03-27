import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsOptional, IsNumberString } from 'class-validator';

export class InitDepositDto {
  @ApiProperty({ example: 'USDC' })
  @IsString()
  @IsNotEmpty()
  assetCode!: string;

  @ApiPropertyOptional({ example: '100.00' })
  @IsNumberString()
  @IsOptional()
  amount?: string;

  @ApiPropertyOptional({ example: 'USD' })
  @IsString()
  @IsOptional()
  fiatCurrency?: string;
}

export class InitWithdrawalDto {
  @ApiProperty({ example: 'USDC' })
  @IsString()
  @IsNotEmpty()
  assetCode!: string;

  @ApiProperty({ example: '50.00' })
  @IsNumberString()
  amount!: string;

  @ApiPropertyOptional({ example: 'USD' })
  @IsString()
  @IsOptional()
  fiatCurrency?: string;
}
