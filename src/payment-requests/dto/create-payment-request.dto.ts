import { IsUUID, IsString, IsNumber, Min, IsOptional, IsPositive, IsNotEmpty } from 'class-validator';
import { ApiPropertyOptional, ApiProperty } from '@nestjs/swagger';

export class CreatePaymentRequestDto {
  @ApiProperty({ description: 'ID of the payer (contact to request from)' })
  @IsUUID()
  payerId: string;

  @ApiProperty({ description: 'Asset code (tokenId), e.g. XLM, USDC' })
  @IsString()
  @IsNotEmpty()
  asset: string;

  @ApiProperty({ description: 'Amount to request' })
  @IsNumber()
  @IsPositive()
  amount: number;

  @ApiPropertyOptional({ description: 'Optional note/message' })
  @IsOptional()
  @IsString()
  note?: string;

  @ApiProperty({ description: 'Expiry in hours', minimum: 1, maximum: 24 })
  @IsNumber()
  @Min(1)
  @IsPositive()
  expiresInHours: number;
}
