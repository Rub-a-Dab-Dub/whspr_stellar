import { RevenueSourceType } from '../revenue.types';
import { ApiProperty } from '@nestjs/swagger';

export class RevenueRecordDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  sourceType: RevenueSourceType;

  @ApiProperty()
  sourceId: string;

  @ApiProperty()
  amount: string;

  @ApiProperty()
  tokenId: string;

  @ApiProperty()
  usdValue: number;

  @ApiProperty()
  period: string;

  @ApiProperty()
  createdAt: Date;
}

