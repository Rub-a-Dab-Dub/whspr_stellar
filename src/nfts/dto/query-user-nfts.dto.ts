import { IsBooleanString, IsEnum, IsOptional, IsString } from 'class-validator';
import { WalletNetwork } from '../../wallets/entities/wallet.entity';

export class QueryUserNFTsDto {
  @IsOptional()
  @IsString()
  collection?: string;

  @IsOptional()
  @IsString()
  contractAddress?: string;

  @IsOptional()
  @IsString()
  tokenId?: string;

  @IsOptional()
  @IsEnum(WalletNetwork)
  network?: WalletNetwork;

  @IsOptional()
  @IsBooleanString()
  refresh?: string;
}
