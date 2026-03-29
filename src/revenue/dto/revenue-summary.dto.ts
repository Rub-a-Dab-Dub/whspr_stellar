import { ApiProperty } from '@nestjs/swagger';

export class RevenueBySourceDto {
  @ApiProperty()
  sourceType: string;

  @ApiProperty()
  tokenId: string;

  @ApiProperty()
  totalAmount: string;

  @ApiProperty()
  totalUsd: number;
}

export class RevenueSummaryDto {
  @ApiProperty()
  period: string;

  @ApiProperty({ type: [RevenueBySourceDto] })
  bySource: RevenueBySourceDto[];

  @ApiProperty()
  totalCollectedUsd: number;

  @ApiProperty()
  totalRecords: number;
}

