import { IsUUID } from 'class-validator';

export class TradeRewardDto {
  @IsUUID()
  userRewardId!: string;

  @IsUUID()
  targetUserId!: string;
}
