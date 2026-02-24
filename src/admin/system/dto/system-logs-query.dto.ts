import { Transform } from 'class-transformer';
import {
  IsEnum,
  IsISO8601,
  IsInt,
  IsOptional,
  Max,
  Min,
} from 'class-validator';

export enum SystemLogLevel {
  WARN = 'warn',
  ERROR = 'error',
}

export class SystemLogsQueryDto {
  @IsOptional()
  @IsEnum(SystemLogLevel)
  level?: SystemLogLevel;

  @IsOptional()
  @IsISO8601()
  startDate?: string;

  @IsOptional()
  @Transform(({ value }) =>
    value === undefined || value === null || value === ''
      ? undefined
      : parseInt(value, 10),
  )
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 100;
}
