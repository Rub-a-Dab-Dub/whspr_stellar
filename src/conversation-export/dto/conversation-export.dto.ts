import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional } from 'class-validator';
import {
  ConversationExportFormat,
  ConversationExportStatus,
} from '../entities/conversation-export-job.entity';

export class RequestConversationExportDto {
  @ApiPropertyOptional({ enum: ConversationExportFormat, default: ConversationExportFormat.JSON })
  @IsOptional()
  @IsEnum(ConversationExportFormat)
  format?: ConversationExportFormat;
}

export class ConversationExportJobResponseDto {
  @ApiProperty()
  jobId!: string;

  @ApiProperty({ enum: ConversationExportStatus })
  status!: ConversationExportStatus;

  @ApiProperty({ enum: ConversationExportFormat })
  format!: ConversationExportFormat;

  @ApiProperty()
  requestedAt!: string;
}

export class ConversationExportStatusResponseDto {
  @ApiProperty()
  jobId!: string;

  @ApiProperty({ enum: ConversationExportStatus })
  status!: ConversationExportStatus;

  @ApiProperty({ enum: ConversationExportFormat })
  format!: ConversationExportFormat;

  @ApiPropertyOptional()
  fileUrl?: string;

  @ApiPropertyOptional()
  fileSize?: number;

  @ApiPropertyOptional()
  completedAt?: string;

  @ApiPropertyOptional()
  expiresAt?: string;
}

export class ConversationExportDownloadResponseDto {
  @ApiProperty()
  url!: string;

  @ApiProperty()
  expiresAt!: string;

  @ApiProperty({ enum: ConversationExportFormat })
  format!: ConversationExportFormat;

  @ApiPropertyOptional()
  fileSize?: number;
}
