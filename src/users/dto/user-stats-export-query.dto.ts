import { IsIn, IsOptional } from 'class-validator';

export class UserStatsExportQueryDto {
  @IsOptional()
  @IsIn(['json', 'csv'])
  format?: 'json' | 'csv';
}
