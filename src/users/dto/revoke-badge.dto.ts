import { IsString } from 'class-validator';

export class RevokeBadgeDto {
  @IsString()
  reason: string;
}
