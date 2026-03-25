import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { ReportTargetType } from '../entities/report.entity';

export class SubmitReportDto {
  @ApiProperty({ enum: ReportTargetType })
  @IsEnum(ReportTargetType)
  targetType!: ReportTargetType;

  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  targetId!: string;

  @ApiProperty({ example: 'harassment' })
  @IsString()
  @MaxLength(120)
  reason!: string;

  @ApiPropertyOptional({ example: 'Repeated abusive language in multiple replies.' })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string;
}
