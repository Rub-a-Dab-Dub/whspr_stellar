import { IsOptional, IsIn, IsBooleanString } from 'class-validator';

export class GetBadgesDto {
  @IsOptional()
  category?: string;

  @IsOptional()
  rarity?: string;

  @IsOptional()
  isActive?: boolean;

  @IsOptional()
  page?: number;

  @IsOptional()
  limit?: number;
}
