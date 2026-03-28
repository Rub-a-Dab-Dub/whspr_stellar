import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsInt, IsOptional, IsString, Length, Max, Min } from 'class-validator';

export class DiscoverUsersQueryDto {
  @ApiProperty({ description: 'Username or display name query' })
  @IsString()
  @Length(1, 50)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  q!: string;

  @ApiPropertyOptional({ description: 'Max results to return', minimum: 1, maximum: 30 })
  @IsOptional()
  @Transform(({ value }) => (value === undefined ? undefined : Number(value)))
  @IsInt()
  @Min(1)
  @Max(30)
  limit?: number;
}

export class DiscoveryResultDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  username!: string;

  @ApiPropertyOptional()
  displayName!: string | null;

  @ApiPropertyOptional()
  avatarUrl!: string | null;

  @ApiPropertyOptional()
  bio!: string | null;

  @ApiProperty()
  walletAddressMasked!: string;

  @ApiProperty()
  relevanceScore!: number;

  @ApiProperty()
  reputationScore!: number;

  @ApiProperty()
  mutualContactsCount!: number;
}

export class PublicProfileCardDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  username!: string;

  @ApiPropertyOptional()
  displayName!: string | null;

  @ApiPropertyOptional()
  avatarUrl!: string | null;

  @ApiPropertyOptional()
  bio!: string | null;

  @ApiProperty()
  walletAddressMasked!: string;

  @ApiProperty()
  tier!: string;

  @ApiProperty()
  isVerified!: boolean;

  @ApiProperty()
  reputationScore!: number;

  @ApiProperty()
  mutualContactsCount!: number;

  @ApiProperty()
  deepLink!: string;
}
