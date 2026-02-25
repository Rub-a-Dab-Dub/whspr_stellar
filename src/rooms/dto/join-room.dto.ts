import { IsString, IsNotEmpty } from 'class-validator';

export class JoinRoomDto {
  @IsString()
  @IsNotEmpty()
  userWalletAddress: string;
}

export class ConfirmJoinDto {
  @IsString()
  @IsNotEmpty()
  transactionHash: string;
}

export class PaymentInstructionsDto {
  contractAddress: string;
  amount: string;
  tokenAddress: string;
  recipientAddress: string;
}