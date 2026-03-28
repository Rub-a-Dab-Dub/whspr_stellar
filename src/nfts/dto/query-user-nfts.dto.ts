import { IsBooleanString, IsEnum, IsOptional, IsString } from 'class-validator';
import { WalletNetwork } from '../../wallets/entities/wallet.entity';
import { validationMessages } from '../../i18n/validation-messages';

export class QueryUserNFTsDto {
  @IsOptional()
  @IsString({ message: validationMessages.string() })
  collection?: string;

  @IsOptional()
  @IsString({ message: validationMessages.string() })
  contractAddress?: string;

  @IsOptional()
  @IsString({ message: validationMessages.string() })
  tokenId?: string;

  @IsOptional()
  @IsEnum(WalletNetwork, {
    message: validationMessages.enum(Object.values(WalletNetwork)),
  })
  network?: WalletNetwork;

  @IsOptional()
  @IsBooleanString({ message: validationMessages.booleanString() })
  refresh?: string;
}
