import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsEnum, IsOptional, MaxLength, Length, Matches } from 'class-validator';
import { WalletNetwork } from '../entities/wallet.entity';
import { validationMessages } from '../../i18n/validation-messages';

export class AddWalletDto {
  @ApiProperty({
    description: 'Stellar wallet public key',
    example: 'GCZJM35NKGVK47BB4SPBDV25477PZYIYPVVG453LPYFNXLS3FGHDXOCM',
  })
  @IsString({ message: validationMessages.string() })
  @Length(56, 56, { message: validationMessages.exactLength(56) })
  @Matches(/^G[A-Z2-7]{55}$/, { message: validationMessages.stellarAddressFormat() })
  walletAddress!: string;

  @ApiPropertyOptional({
    description: 'Signature of the verification message (base64 encoded)',
    example: 'SGVsbG8gV29ybGQhIFRoaXMgaXMgYSBzaWduYXR1cmUgZXhhbXBsZQ==',
  })
  @IsOptional()
  @IsString({ message: validationMessages.string() })
  signature?: string;

  @ApiPropertyOptional({
    enum: WalletNetwork,
    default: WalletNetwork.STELLAR_MAINNET,
    example: WalletNetwork.STELLAR_MAINNET,
  })
  @IsOptional()
  @IsEnum(WalletNetwork, {
    message: validationMessages.enum(Object.values(WalletNetwork)),
  })
  network?: WalletNetwork;

  @ApiPropertyOptional({
    description: 'Human-readable label for this wallet',
    example: 'My main wallet',
    maxLength: 100,
  })
  @IsOptional()
  @IsString({ message: validationMessages.string() })
  @MaxLength(100, { message: validationMessages.maxLength(100) })
  label?: string;
}
