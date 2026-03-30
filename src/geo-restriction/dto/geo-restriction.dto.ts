import { RestrictionType } from '../entities/geo-restriction.entity';

export class CreateGeoRestrictionDto {
  countryCode!: string;
  restrictionType!: RestrictionType;
  affectedFeatures?: string[];
  reason?: string;
}

export class GeoRestrictionResponseDto {
  id!: string;
  countryCode!: string;
  restrictionType!: RestrictionType;
  affectedFeatures?: string[];
  reason?: string;
  isActive!: boolean;
  createdAt!: Date;
}

export class MyRestrictionsResponseDto {
  countryCode!: string;
  isVPN!: boolean;
  restrictions!: GeoRestrictionResponseDto[];
  blockedFeatures!: string[];
  requiresKyc!: boolean;
  isFullyBlocked!: boolean;
}

export class ApplyRestrictionResultDto {
  allowed!: boolean;
  reason?: string;
  restrictionType?: RestrictionType;
}
