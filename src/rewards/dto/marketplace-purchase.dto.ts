import { IsUUID } from 'class-validator';

export class MarketplacePurchaseDto {
  @IsUUID()
  listingId!: string;
}
