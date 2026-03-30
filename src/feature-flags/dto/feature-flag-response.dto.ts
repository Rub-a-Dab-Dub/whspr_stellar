import { ApiProperty } from '@nestjs/swagger';
import { UserTier } from '../../users/entities/user.entity';

export class FeatureFlagResponseDto {
  @ApiProperty()
  key!: string;

  @ApiProperty()
  isEnabled!: boolean;

  @ApiProperty()
  rolloutPercentage!: number;

  @ApiProperty({ type: [String] })
  allowedUserIds!: string[];

  @ApiProperty({ enum: UserTier, isArray: true })
  allowedTiers!: UserTier[];

  @ApiProperty({ nullable: true })
  description!: string | null;

  @ApiProperty()
  updatedAt!: Date;
}

export class MyFeatureFlagResponseDto {
  @ApiProperty()
  key!: string;

  @ApiProperty()
  enabled!: boolean;

  @ApiProperty()
  rolloutPercentage!: number;

  @ApiProperty({ nullable: true })
  description!: string | null;
}
