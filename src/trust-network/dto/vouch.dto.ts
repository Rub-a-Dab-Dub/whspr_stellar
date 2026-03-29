import { IsUUID, IsNumber, Min, Max, IsOptional, IsString, IsNotEmpty } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class VouchDto {
  @ApiPropertyOptional({ description: 'Trust score 1-5', example: 4 })
  @IsNumber()
  @Min(1)
  @Max(5)
  trustScore!: number;

  @ApiPropertyOptional({ description: 'Optional comment', example: 'Reliable contact' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  comment?: string;
}

export class TrustResponseDto {
  @ApiProperty()
  userId!: string;

  @ApiProperty()
  score!: number;

  @ApiProperty()
  vouchCount!: number;

  @ApiProperty()
  revokedCount!: number;

  @ApiProperty()
  networkDepth!: number;

  @ApiProperty()
  calculatedAt!: Date;
}

export class VouchersResponseDto {
  @ApiProperty({ type: [String] })
  vouchers!: string[];

  @ApiProperty({ type: [Number] })
  scores!: number[];
}

export class VouchedResponseDto {
  @ApiProperty({ type: [String] })
  vouched!: string[];

  @ApiProperty({ type: [Number] })
  scores!: number[];
}
