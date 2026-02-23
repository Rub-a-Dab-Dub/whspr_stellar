import { IsString, IsUrl, IsEnum, IsOptional } from 'class-validator';
import { BadgeCategory, BadgeRarity } from '../../users/entities/badge.entity';

export class CreateBadgeDto {
  @IsString()
  name: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsUrl({ require_tld: false })
  @IsOptional()
  imageUrl?: string;

  @IsEnum(BadgeCategory)
  @IsOptional()
  category?: BadgeCategory;

  @IsEnum(BadgeRarity)
  @IsOptional()
  rarity?: BadgeRarity;

  @IsOptional()
  isActive?: boolean;
}
