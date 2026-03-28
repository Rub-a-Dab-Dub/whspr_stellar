import { IsNumber, IsString, IsOptional } from 'class-validator';

export class EstimateFeeDto {
  @IsString()
  operation!: 'transfer' | 'tip' | 'split' | 'treasury';

  @IsNumber()
  amount!: number;

  @IsString()
  @IsOptional()
  userTier?: 'free' | 'silver' | 'gold' | 'platinum';
}
