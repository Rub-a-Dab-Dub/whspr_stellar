
import { IsString } from 'class-validator';
export class ReverseTransactionDto {
  @IsString()
  traceId!: string; // or txHash
  reason?: string;
}
