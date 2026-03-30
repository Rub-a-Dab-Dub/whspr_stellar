import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsUUID, ArrayMaxSize } from 'class-validator';
import { BadgeTier, BadgeKey, BadgeCriteria } from '../entities/badge.entity';

export class BadgeResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty({ enum: BadgeKey }) key!: BadgeKey;
  @ApiProperty() name!: string;
  @ApiProperty() description!: string;
  @ApiPropertyOptional() iconUrl!: string | null;
  @ApiProperty({ enum: BadgeTier }) tier!: BadgeTier;
  @ApiProperty() criteria!: BadgeCriteria;
  @ApiProperty() createdAt!: Date;
}

export class UserBadgeResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty() userId!: string;
  @ApiProperty() badgeId!: string;
  @ApiProperty() badge!: BadgeResponseDto;
  @ApiProperty() isDisplayed!: boolean;
  @ApiProperty() awardedAt!: Date;
}

export class UpdateDisplayedBadgesDto {
  @ApiProperty({ type: [String], maxItems: 3 })
  @IsArray()
  @IsUUID('4', { each: true })
  @ArrayMaxSize(3)
  badgeIds!: string[];
}
