import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
  Matches,
} from 'class-validator';
import { WalletNetwork } from '../../wallets/entities/wallet.entity';

const STELLAR_ADDRESS_REGEX = /^[GC][A-Z2-7]{55}$/;

export class CreateSavedAddressDto {
  @ApiProperty({ description: 'Stellar wallet address (56 chars, G... or C...)' })
  @IsString()
  @Matches(STELLAR_ADDRESS_REGEX, {
    message: 'walletAddress must be a valid 56-char Stellar address starting with G or C',
  })
  walletAddress!: string;

  @ApiProperty({ description: 'Payment alias, unique per user (case-insensitive)' })
  @IsString()
  @MaxLength(64)
  alias!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  avatarUrl?: string;

  @ApiPropertyOptional({ enum: WalletNetwork, default: WalletNetwork.STELLAR_MAINNET })
  @IsOptional()
  @IsEnum(WalletNetwork)
  network?: WalletNetwork;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];
}

export class UpdateSavedAddressDto {
  @ApiPropertyOptional({ description: 'Alias unique per user (case-insensitive)' })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  alias?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  avatarUrl?: string;

  @ApiPropertyOptional({ enum: WalletNetwork })
  @IsOptional()
  @IsEnum(WalletNetwork)
  network?: WalletNetwork;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];
}

export class SearchSavedAddressesDto {
  @ApiPropertyOptional({ description: 'Search by alias, address substring, or tag' })
  @IsOptional()
  @IsString()
  q?: string;

  @ApiPropertyOptional({ description: 'Filter by single tag' })
  @IsOptional()
  @IsString()
  tag?: string;

  @ApiPropertyOptional({ description: 'Autocomplete mode sorted by usage frequency', default: false })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) => value === true || value === 'true')
  @IsBoolean()
  suggest?: boolean;
}

export class SavedAddressResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  userId!: string;

  @ApiProperty()
  walletAddress!: string;

  @ApiProperty()
  alias!: string;

  @ApiPropertyOptional()
  avatarUrl?: string | null;

  @ApiProperty({ enum: WalletNetwork })
  network!: WalletNetwork;

  @ApiProperty({ type: [String] })
  tags!: string[];

  @ApiPropertyOptional()
  lastUsedAt?: Date | null;

  @ApiProperty()
  usageCount!: number;

  @ApiProperty()
  createdAt!: Date;
}
