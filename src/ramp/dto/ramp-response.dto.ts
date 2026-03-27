import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { RampStatus, RampType } from '../entities/ramp-transaction.entity';

export class RampTransactionDto {
  @ApiProperty() id!: string;
  @ApiProperty() userId!: string;
  @ApiProperty({ enum: RampType }) type!: RampType;
  @ApiProperty() assetCode!: string;
  @ApiPropertyOptional() amount!: string | null;
  @ApiPropertyOptional() fiatAmount!: string | null;
  @ApiPropertyOptional() fiatCurrency!: string | null;
  @ApiProperty({ enum: RampStatus }) status!: RampStatus;
  @ApiPropertyOptional() anchorId!: string | null;
  @ApiPropertyOptional() anchorUrl!: string | null;
  @ApiPropertyOptional() txHash!: string | null;
  @ApiProperty() createdAt!: Date;
  @ApiProperty() updatedAt!: Date;
}

export class InitRampResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty({ description: 'Anchor interactive URL for the user to complete the flow' })
  anchorUrl!: string;
  @ApiProperty({ enum: RampStatus }) status!: RampStatus;
}
