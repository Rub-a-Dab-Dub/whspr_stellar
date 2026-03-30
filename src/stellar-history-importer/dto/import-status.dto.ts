import { ImportJobStatus } from '../entities/history-import-job.entity';

export class ImportStatusDto {
  jobId!: string;
  walletId!: string;
  status!: ImportJobStatus;
  totalImported!: number;
  cursor?: string;
  errorMessage?: string;
  startedAt!: Date;
  completedAt?: Date;
}

export class TriggerImportResponseDto {
  jobId!: string;
  message!: string;
}

export class TriggerImportBodyDto {
  walletAddress!: string;
}
