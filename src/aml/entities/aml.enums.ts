import { ApiProperty } from '@nestjs/swagger';

export enum AmlFlagType {
  LARGE_AMOUNT = 'LARGE_AMOUNT',
  RAPID_SUCCESSION = 'RAPID_SUCCESSION',
  STRUCTURING = 'STRUCTURING',
  UNUSUAL_PATTERN = 'UNUSUAL_PATTERN',
}

export enum AmlRiskLevel {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL',
}

export enum AmlFlagStatus {
  OPEN = 'OPEN',
  REVIEWED = 'REVIEWED',
  REPORTED = 'REPORTED',
  CLEARED = 'CLEARED',
}

export enum ComplianceReportType {
  SAR = 'SAR',
  CTR = 'CTR',
}

