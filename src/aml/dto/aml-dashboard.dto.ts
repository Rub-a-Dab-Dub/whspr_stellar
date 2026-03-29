import { ApiProperty } from '@nestjs/swagger';
import { AmlFlagType, AmlRiskLevel } from '../entities/aml.enums';

export class AmlDashboardStats {
  @ApiProperty()
  totalFlags!: number;

  @ApiProperty()
  openFlags!: number;

  @ApiProperty({ enum: AmlRiskLevel, type: Object })
  flagsByRisk!: Record<AmlRiskLevel, number>;

  @ApiProperty({ enum: AmlFlagType, type: Object })
  flagsByType!: Record<AmlFlagType, number>;

  @ApiProperty()
  recentFlags!: number; // last 24h
}

export class AmlDashboardDto {
  @ApiProperty()
  stats!: AmlDashboardStats;

  @ApiProperty()
  criticalAlerts!: number;
}

