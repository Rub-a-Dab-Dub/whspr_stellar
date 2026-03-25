import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class AssetBalanceDto {
  @ApiProperty({ example: 'XLM' })
  assetCode!: string;

  @ApiPropertyOptional({ example: 'native' })
  assetType!: string;

  @ApiPropertyOptional({ example: null, nullable: true })
  assetIssuer!: string | null;

  @ApiProperty({ example: '100.0000000' })
  balance!: string;

  @ApiPropertyOptional({ example: '0.5000000' })
  buyingLiabilities!: string;

  @ApiPropertyOptional({ example: '0.0000000' })
  sellingLiabilities!: string;
}

export class BalanceResponseDto {
  @ApiProperty({ example: 'GCZJM35NKGVK47BB4SPBDV25477PZYIYPVVG453LPYFNXLS3FGHDXOCM' })
  walletAddress!: string;

  @ApiProperty({ type: [AssetBalanceDto] })
  balances!: AssetBalanceDto[];

  @ApiProperty({ example: '2024-01-01T00:00:00.000Z' })
  fetchedAt!: string;

  @ApiProperty({ example: false, description: 'Whether this result came from cache' })
  cached!: boolean;
}
