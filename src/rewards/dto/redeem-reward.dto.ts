import { IsUUID } from 'class-validator';

export class RedeemRewardDto {
  @IsUUID()
  userRewardId!: string;
}
