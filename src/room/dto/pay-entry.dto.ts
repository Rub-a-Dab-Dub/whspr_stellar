import { IsString, IsNotEmpty, IsOptional, IsBoolean } from 'class-validator';

export class PayEntryDto {
  @IsString()
  @IsNotEmpty()
  transactionHash: string;

  @IsString()
  @IsOptional()
  blockchainNetwork?: string;

  @IsBoolean()
  @IsOptional()
  useFreeTrial?: boolean;
}
