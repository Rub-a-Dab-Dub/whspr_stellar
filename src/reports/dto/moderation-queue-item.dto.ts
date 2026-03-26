import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ReportStatus, ReportTargetType } from '../entities/report.entity';

export class ModerationQueueItemDto {
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

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty()
  reportCount!: number;

  @ApiProperty()
  severity!: number;

  @ApiProperty()
  isPriority!: boolean;
}
