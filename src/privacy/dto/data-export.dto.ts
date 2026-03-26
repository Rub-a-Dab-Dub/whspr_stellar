import { IsUUID } from 'class-validator';

export class RequestDataExportDto {
  // No additional data needed - user ID comes from auth context
}

export class DataExportResponseDto {
  id!: string;
  userId!: string;
  status!: string;
  fileUrl!: string | null;
  requestedAt!: Date;
  completedAt!: Date | null;
  expiresAt!: Date | null;
  errorMessage!: string | null;
}

export class ExportStatusResponseDto {
  id!: string;
  status!: string;
  progress!: number;
  estimatedTime!: number;
  fileUrl!: string | null;
  expiresAt!: Date | null;
  errorMessage!: string | null;
}

export class DataExportMetadataDto {
  exportId!: string;
  userId!: string;
  userName!: string;
  email!: string;
  exportDate!: Date;
  includedData!: string[];
  totalSize!: number;
  checksumSHA256!: string;
}
