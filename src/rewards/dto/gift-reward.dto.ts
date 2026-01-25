import { IsUUID } from 'class-validator';

export class GiftRewardDto {
  @IsUUID()
  userRewardId!: string;

  @IsUUID()
  recipientUserId!: string;
}
