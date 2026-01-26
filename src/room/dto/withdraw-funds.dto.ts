import { IsString, IsNotEmpty, IsNumberString } from 'class-validator';

export class WithdrawFundsDto {
  @IsString()
  @IsNotEmpty()
  address: string;

  @IsNumberString()
  @IsNotEmpty()
  amount: string;

  @IsString()
  @IsNotEmpty()
  blockchainNetwork: string;
}
