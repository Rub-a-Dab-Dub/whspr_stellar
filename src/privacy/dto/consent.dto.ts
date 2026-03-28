import { IsEnum, IsBoolean, IsOptional, IsString } from 'class-validator';

export enum ConsentType {
  MARKETING = 'marketing',
  ANALYTICS = 'analytics',
  COOKIES = 'cookies',
  PROFILING = 'profiling',
  THIRD_PARTY = 'third_party',
}

export class GrantConsentDto {
  @IsEnum(ConsentType)
  consentType!: ConsentType;

  @IsBoolean()
  isGranted!: boolean;

  @IsString()
  @IsOptional()
  userAgent?: string;
}

export class ConsentRecordResponseDto {
  id!: string;
  consentType!: ConsentType;
  isGranted!: boolean;
  grantedAt!: Date;
  revokedAt!: Date | null;
}

export class ConsentHistoryResponseDto {
  consentType!: ConsentType;
  currentStatus!: boolean;
  history!: ConsentRecordResponseDto[];
}

export class AllConsentsResponseDto {
  [consentType: string]: {
    isGranted: boolean;
    grantedAt: Date;
    revokedAt: Date | null;
  };
}
