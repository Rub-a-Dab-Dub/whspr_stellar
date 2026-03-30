import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { AmlFlagType, AmlRiskLevel, AmlFlagStatus } from '../entities/aml.enums';

export class AmlFlagDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  transactionId!: string;

  @ApiProperty()
  userId!: string | null;

  @ApiProperty({ enum: AmlFlagType })
  flagType!: AmlFlagType;

  @ApiProperty({ enum: AmlRiskLevel })
  riskLevel!: AmlRiskLevel;

  @ApiProperty({ enum: AmlFlagStatus })
  status!: AmlFlagStatus;

  @ApiProperty()
  reviewedBy!: string | null;

  @ApiProperty()
  reviewNotes!: string | null;

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty()
  updatedAt!: Date;
}

export class ReviewFlagDto {
  @ApiProperty({ enum: ['review', 'clear', 'report'] })
  action!: 'review' | 'clear' | 'report';

  @ApiPropertyOptional()
  notes?: string;
}

