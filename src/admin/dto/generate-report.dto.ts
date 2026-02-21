import { IsEnum, IsDateString } from 'class-validator';
import { ReportType, ReportFormat } from '../entities/report-job.entity';

export class GenerateReportDto {
  @IsEnum(ReportType)
  type: ReportType;

  @IsEnum(ReportFormat)
  format: ReportFormat;

  @IsDateString()
  startDate: string;

  @IsDateString()
  endDate: string;
}
