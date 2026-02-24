import { IsBoolean } from 'class-validator';

export class ClearFailedJobsDto {
  @IsBoolean()
  confirm: boolean;
}
