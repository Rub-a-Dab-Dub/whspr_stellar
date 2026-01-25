import { IsUUID, IsNumber, Min } from 'class-validator';

export class MarketplaceListDto {
  @IsUUID()
  userRewardId!: string;

  @IsNumber()
  @Min(0)
  price!: number;
}
