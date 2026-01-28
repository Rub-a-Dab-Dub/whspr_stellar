import { IsEnum } from 'class-validator';
import { SupportedChain } from '../enums/supported-chain.enum';

export class UpdateChainPreferenceDto {
  @IsEnum(SupportedChain)
  preferredChain: SupportedChain;
}
