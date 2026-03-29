import { ApiProperty } from '@nestjs/swagger';

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class PortfolioBalanceDto {
  @ApiProperty()
  symbol!: string;

  @ApiPropertyOptional()
  contractId?: string;

  @ApiProperty()
  amount!: string;

  @ApiProperty()
  usdValue!: number;

  @ApiProperty({ example: 25.5 })
  allocationPercent!: number;
}

export class PortfolioResponseDto {
  @ApiProperty({ example: 12500.75 })
  totalUsdValue!: number;

  @ApiProperty({ type: [PortfolioBalanceDto] })
  balances!: PortfolioBalanceDto[];

  @ApiProperty()
  updatedAt!: Date;

  @ApiProperty({ example: -2.5 })
  pnl24h!: number;

  @ApiProperty({ example: 15.2 })
  pnl7d!: number;
}

export class PortfolioHistoryDto {
  @ApiProperty()
  date!: Date;

  @ApiProperty()
  totalUsdValue!: number;
}

export class PortfolioAllocationDto {
  @ApiProperty({ type: [PortfolioBalanceDto] })
  allocation!: PortfolioBalanceDto[];
}

export class PortfolioPnLDto {
  @ApiProperty({ example: -2.5 })
  pnl24h!: number;

  @ApiProperty({ example: 15.2 })
  pnl7d!: number;

  @ApiProperty({ example: 45.8 })
  pnl30d!: number;
}


