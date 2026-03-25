import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ReportStatus, ReportTargetType } from '../entities/report.entity';

export class ReportResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ enum: ReportTargetType })
  targetType!: ReportTargetType;

  @ApiProperty({ format: 'uuid' })
  targetId!: string;

  @ApiProperty()
  reason!: string;

  @ApiPropertyOptional()
  description!: string | null;

  @ApiProperty({ enum: ReportStatus })
  status!: ReportStatus;

  @ApiPropertyOptional({ format: 'uuid' })
  reviewedBy!: string | null;

  @ApiPropertyOptional()
  reviewedAt!: Date | null;

  @ApiProperty()
  createdAt!: Date;
}
