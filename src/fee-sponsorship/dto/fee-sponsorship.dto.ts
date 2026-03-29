import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';

export class SponsorshipQuotaResponseDto {
  @ApiProperty()
  period!: string;

  @ApiProperty()
  quotaUsed!: number;

  @ApiProperty()
  quotaLimit!: number;

  @ApiProperty()
  remaining!: number;

  @ApiProperty()
  resetAt!: string;

  @ApiProperty()
  eligible!: boolean;

  @ApiPropertyOptional()
  ineligibleReason?: string | null;
}

export class SponsorshipHistoryItemDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  txHash!: string;

  @ApiProperty()
  feeAmount!: string;

  @ApiProperty()
  sponsoredBy!: string;

  @ApiPropertyOptional()
  tokenId!: string | null;

  @ApiProperty()
  createdAt!: string;
}

export class SponsorshipHistoryResponseDto {
  @ApiProperty({ type: [SponsorshipHistoryItemDto] })
  items!: SponsorshipHistoryItemDto[];

  @ApiProperty()
  total!: number;

  @ApiProperty()
  page!: number;

  @ApiProperty()
  limit!: number;
}

export class AdminSponsorshipConfigDto {
  @ApiPropertyOptional({ minimum: 0, maximum: 1_000_000 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(1_000_000)
  silverQuota?: number;

  @ApiPropertyOptional({ minimum: 0, maximum: 1_000_000 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(1_000_000)
  goldQuota?: number;

  @ApiPropertyOptional({ minimum: 0, maximum: 1_000_000 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(1_000_000)
  blackQuota?: number;

  @ApiPropertyOptional({ minimum: 1, maximum: 365 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(365)
  newUserDays?: number;
}

export class AdminSponsorshipConfigResponseDto {
  @ApiProperty()
  silverQuota!: number;

  @ApiProperty()
  goldQuota!: number;

  @ApiProperty()
  blackQuota!: number;

  @ApiProperty()
  newUserDays!: number;
}
