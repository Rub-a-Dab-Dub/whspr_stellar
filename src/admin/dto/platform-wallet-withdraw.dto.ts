import { IsString, IsNotEmpty, Matches } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class PlatformWalletWithdrawDto {
  @ApiProperty({
    description: 'Blockchain network (ethereum, bnb, celo, base)',
  })
  @IsString()
  @IsNotEmpty()
  chain: string;

  @ApiProperty({
    description: 'Amount to withdraw (as string to preserve precision)',
  })
  @IsString()
  @IsNotEmpty()
  @Matches(/^\d+(\.\d+)?$/, { message: 'Amount must be a valid number' })
  amount: string;

  @ApiProperty({ description: 'Recipient address (must be whitelisted)' })
  @IsString()
  @IsNotEmpty()
  @Matches(/^0x[a-fA-F0-9]{40}$/, {
    message: 'Invalid Ethereum address format',
  })
  toAddress: string;

  @ApiProperty({ description: 'Reason for withdrawal' })
  @IsString()
  @IsNotEmpty()
  reason: string;
}
