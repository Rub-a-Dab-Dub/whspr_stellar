import { IsString, IsNotEmpty, IsNumberString, IsEnum } from 'class-validator';
import { SupportedChain } from '../../chain/enums/supported-chain.enum';

export class WithdrawFundsDto {
  @IsString()
  @IsNotEmpty()
  address: string;

  @IsNumberString()
  @IsNotEmpty()
  amount: string;

  @IsEnum(SupportedChain)
  @IsNotEmpty()
  blockchainNetwork: SupportedChain;
}
