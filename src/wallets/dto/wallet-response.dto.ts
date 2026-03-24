import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Exclude, Expose } from 'class-transformer';
import { WalletNetwork } from '../entities/wallet.entity';

@Exclude()
export class WalletResponseDto {
  @Expose()
  @ApiProperty({ example: '123e4567-e89b-12d3-a456-426614174000' })
  id!: string;

  @Expose()
  @ApiProperty({ example: '123e4567-e89b-12d3-a456-426614174000' })
  userId!: string;

  @Expose()
  @ApiProperty({ example: 'GCZJM35NKGVK47BB4SPBDV25477PZYIYPVVG453LPYFNXLS3FGHDXOCM' })
  walletAddress!: string;

  @Expose()
  @ApiProperty({ enum: WalletNetwork, example: WalletNetwork.STELLAR_MAINNET })
  network!: WalletNetwork;

  @Expose()
  @ApiProperty({ example: false })
  isVerified!: boolean;

  @Expose()
  @ApiProperty({ example: false })
  isPrimary!: boolean;

  @Expose()
  @ApiPropertyOptional({ example: 'My main wallet' })
  label!: string | null;

  @Expose()
  @ApiProperty({ example: '2024-01-01T00:00:00.000Z' })
  createdAt!: Date;

  constructor(partial: Partial<WalletResponseDto>) {
    Object.assign(this, partial);
  }
}
