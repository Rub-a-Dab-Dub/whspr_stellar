import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsBoolean,
  IsEnum,
} from 'class-validator';
import { SupportedChain } from '../../chain/enums/supported-chain.enum';

export class PayEntryDto {
  @IsString()
  @IsNotEmpty()
  transactionHash: string;

  @IsEnum(SupportedChain)
  @IsOptional()
  blockchainNetwork?: SupportedChain;

  @IsBoolean()
  @IsOptional()
  useFreeTrial?: boolean;
}
