import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsEmail,
  IsInt,
  IsISO8601,
  IsOptional,
  Max,
  Min,
} from 'class-validator';

export class GeneratePlatformInviteDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional({ default: 1, description: '1 = single-use' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100_000)
  maxUses?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsISO8601()
  expiresAt?: string;
}

export class BulkGenerateInvitesDto {
  @ApiProperty({ minimum: 1, maximum: 500 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(500)
  count!: number;

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100_000)
  maxUses?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsISO8601()
  expiresAt?: string;
}

export class ToggleInviteModeDto {
  @ApiProperty()
  @IsBoolean()
  enabled!: boolean;
}

export class ListInvitesQueryDto {
  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ default: 50 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}

export class ValidateInviteResponseDto {
  valid!: boolean;
  message?: string;
  expiresAt?: string | null;
  remainingUses?: number;
}

export class PlatformInviteRedemptionResponseDto {
  id!: string;
  userId!: string;
  redeemedAt!: string;
  redeemerUsername!: string | null;
  redeemerWallet!: string | null;
  redeemerEmail!: string | null;
}

export class PlatformInviteAdminResponseDto {
  id!: string;
  createdBy!: string;
  code!: string;
  email!: string | null;
  status!: string;
  maxUses!: number;
  useCount!: number;
  expiresAt!: string | null;
  revokedAt!: string | null;
  lastRedeemedByUserId!: string | null;
  lastRedeemedAt!: string | null;
  createdAt!: string;
  redemptions!: PlatformInviteRedemptionResponseDto[];
}

export class InviteStatsResponseDto {
  inviteModeEnabled!: boolean;
  totalInvites!: number;
  byStatus!: Record<string, number>;
  totalRedemptions!: number;
  unusedActive!: number;
}
