import { ArrayMaxSize, IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { VerifyContentGateDto } from './verify-content-gate.dto';

export const MAX_BATCH_VERIFY = 50;

export class BatchVerifyContentGatesDto {
  @IsArray()
  @ArrayMaxSize(MAX_BATCH_VERIFY)
  @ValidateNested({ each: true })
  @Type(() => VerifyContentGateDto)
  items!: VerifyContentGateDto[];
}
