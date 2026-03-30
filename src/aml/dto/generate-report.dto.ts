import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString } from 'class-validator';
import { ComplianceReportType } from '../entities/aml.enums';

export class GenerateReportDto {
  @ApiProperty({ enum: ComplianceReportType })
  type!: ComplianceReportType;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  period?: string; // YYYY-MM
}

