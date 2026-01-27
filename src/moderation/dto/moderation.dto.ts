import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ReportType, ReportStatus } from '../entities/report.entity';

export class BlockUserDto {
  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  reason?: string;
}

export class CreateReportDto {
  @ApiProperty({ enum: ReportType })
  @IsEnum(ReportType)
  type: ReportType;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  description: string;
}

export class ReviewReportDto {
  @ApiProperty({ enum: ReportStatus })
  @IsEnum(ReportStatus)
  status: ReportStatus;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  moderatorNotes?: string;
}

export class AppealReportDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  appealReason: string;
}
