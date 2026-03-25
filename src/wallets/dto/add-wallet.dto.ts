import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsEnum, IsOptional, MaxLength, Length, Matches } from 'class-validator';
import { WalletNetwork } from '../entities/wallet.entity';

export class AddWalletDto {
  @ApiProperty({
    description: 'Stellar wallet public key',
    example: 'GCZJM35NKGVK47BB4SPBDV25477PZYIYPVVG453LPYFNXLS3FGHDXOCM',
  })
  @IsString()
  @Length(56, 56, { message: 'Stellar address must be exactly 56 characters' })
  @Matches(/^G[A-Z2-7]{55}$/, { message: 'Invalid Stellar address format' })
  walletAddress!: string;

  @ApiPropertyOptional({
    description: 'Signature of the verification message (base64 encoded)',
    example: 'SGVsbG8gV29ybGQhIFRoaXMgaXMgYSBzaWduYXR1cmUgZXhhbXBsZQ==',
  })
  @IsOptional()
  @IsString()
  signature?: string;

  @ApiPropertyOptional({
    enum: WalletNetwork,
    default: WalletNetwork.STELLAR_MAINNET,
    example: WalletNetwork.STELLAR_MAINNET,
  })
  @IsOptional()
  @IsEnum(WalletNetwork)
  network?: WalletNetwork;

  @ApiPropertyOptional({
    description: 'Human-readable label for this wallet',
    example: 'My main wallet',
    maxLength: 100,
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  label?: string;
}
