
import { IsString } from 'class-validator';
export class VoidDisputeDto {
  @IsString()
  traceId!: string; // transaction to void
  reason?: string;
}
