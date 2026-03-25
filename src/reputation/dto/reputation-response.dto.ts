import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Expose, Type } from 'class-transformer';

export class ReputationResponseDto {
  @ApiProperty()
  @Expose()
  userId!: string;

  @ApiProperty()
  @Expose()
  score!: number;

  @ApiProperty()
  @Expose()
  totalRatings!: number;

  @ApiProperty()
  @Expose()
  positiveRatings!: number;

  @ApiProperty()
  @Expose()
  flags!: number;

  @ApiProperty()
  @Expose()
  isUnderReview!: boolean;

  @ApiPropertyOptional({ nullable: true })
  @Expose()
  onChainScore!: number | null;

  @ApiPropertyOptional({ nullable: true })
  @Expose()
  lastChainSyncAt!: Date | null;

  @ApiProperty()
  @Expose()
  lastUpdatedAt!: Date;
}

export class RatingResponseDto {
  @ApiProperty()
  @Expose()
  id!: string;

  @ApiProperty()
  @Expose()
  raterId!: string;

  @ApiProperty()
  @Expose()
  ratedUserId!: string;

  @ApiProperty()
  @Expose()
  conversationId!: string;

  @ApiProperty()
  @Expose()
  score!: number;

  @ApiPropertyOptional({ nullable: true })
  @Expose()
  comment!: string | null;

  @ApiProperty()
  @Expose()
  createdAt!: Date;
}

export class FlagListResponseDto {
  @ApiProperty()
  userId!: string;

  @ApiProperty()
  flags!: number;

  @ApiProperty()
  isUnderReview!: boolean;
}
