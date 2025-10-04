
import { IsString, IsOptional, IsNumberString } from 'class-validator';
export class SimulateTransactionDto {
  @IsString()
  traceId!: string;

  @IsNumberString()
  amount!: string;

  @IsOptional()
  tokenSymbol?: string;

  @IsOptional()
  meta?: Record<string, any>;
}

