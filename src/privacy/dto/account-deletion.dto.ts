import { IsString, IsOptional, IsBoolean } from 'class-validator';

export class DeleteAccountDto {
  @IsString()
  @IsOptional()
  reason?: string;

  @IsBoolean()
  @IsOptional()
  feedbackEmail?: boolean;
}

export class DeleteAccountResponseDto {
  success!: boolean;
  message!: string;
  scheduledFor!: Date;
  cancellationToken!: string;
}

export class DataAnonymizationResultDto {
  userId!: string;
  fieldsAnonymized!: string[];
  transactionsRetained!: number;
  timestamp!: Date;
}
