import { IsEnum, IsOptional, IsString, Length, Matches, MaxLength } from 'class-validator';
import { GatedContentType, GateType } from '../entities/content-gate.entity';
import { WalletNetwork } from '../../wallets/entities/wallet.entity';

export class CreateContentGateDto {
  @IsEnum(GatedContentType)
  contentType!: GatedContentType;

  @IsString()
  @Length(1, 128)
  contentId!: string;

  @IsEnum(GateType)
  gateType!: GateType;

  @IsString()
  @MaxLength(256)
  gateToken!: string;

  @IsOptional()
  @IsString()
  @Matches(/^\d+(\.\d+)?$/u, { message: 'minBalance must be a non-negative decimal string' })
  minBalance?: string;

  @IsOptional()
  @IsEnum(WalletNetwork)
  network?: WalletNetwork;
}
