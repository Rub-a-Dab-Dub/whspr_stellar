import { IsEnum, IsOptional, IsNumber } from 'class-validator';
import { SupportedChain } from '../enums/supported-chain.enum';

export class SelectChainDto {
  @IsEnum(SupportedChain)
  chain: SupportedChain;

  @IsNumber()
  @IsOptional()
  walletChainId?: number;
}
