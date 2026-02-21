import { IsOptional, IsIn, IsNumberString } from 'class-validator';

export class GetTransactionsDto {
  @IsOptional()
  @IsIn(['tip', 'room_entry', 'p2p_transfer', 'withdrawal', 'refund'])
  type?: string;

  @IsOptional()
  @IsIn(['pending', 'confirmed', 'failed'])
  status?: string;

  @IsOptional()
  userId?: string; // filter by sender or receiver

  @IsOptional()
  minAmount?: string;

  @IsOptional()
  maxAmount?: string;

  @IsOptional()
  startDate?: string;

  @IsOptional()
  endDate?: string;

  @IsOptional()
  chainId?: string;

  @IsOptional()
  @IsNumberString()
  page?: number;

  @IsOptional()
  @IsNumberString()
  limit?: number;
}
