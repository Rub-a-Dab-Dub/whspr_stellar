import { IsEnum, IsOptional, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { KYCTier } from '../entities/kyc-record.entity';

export class InitiateKYCDto {
  @ApiProperty({ description: 'Tier to verify for', enum: KYCTier })
  @IsEnum(KYCTier)
  tier!: KYCTier;

  @ApiPropertyOptional({ description: 'KYC provider to use' })
  @IsOptional()
  @IsString()
  provider?: string;
}

export class KYCWebhookDto {
  @ApiProperty({ description: 'External ID from KYC provider' })
  @IsString()
  externalId!: string;

  @ApiProperty({ description: 'Status from provider' })
  @IsString()
  status!: string;

  @ApiPropertyOptional({ description: 'Rejection reason if rejected' })
  @IsOptional()
  @IsString()
  rejectionReason?: string;

  @ApiPropertyOptional({ description: 'Additional data from provider' })
  @IsOptional()
  documents?: Record<string, any>;
}

export class KYCStatusResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  userId!: string;

  @ApiProperty()
  status!: string;

  @ApiProperty()
  tier!: string;

  @ApiPropertyOptional()
  verifiedAt?: Date | null;

  @ApiPropertyOptional()
  rejectionReason?: string | null;

  @ApiPropertyOptional()
  resubmissionAllowedAt?: Date | null;

  @ApiProperty()
  createdAt!: Date;
}

export class KYCRequirementsResponseDto {
  @ApiProperty()
  tier!: string;

  @ApiProperty()
  required!: boolean;

  @ApiProperty({ type: [String] })
  documents!: string[];

  @ApiProperty()
  transferThreshold!: number;
}