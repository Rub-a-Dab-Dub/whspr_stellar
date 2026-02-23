import { IsString } from 'class-validator';

export class GrantBadgeDto {
  @IsString()
  badgeId: string;

  @IsString()
  reason: string;
}
