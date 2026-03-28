import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { AppPlatform } from '../entities/app-version.entity';

export class AppVersionResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty({ enum: AppPlatform })
  platform!: AppPlatform;

  @ApiProperty()
  version!: string;

  @ApiProperty()
  minSupportedVersion!: string;

  @ApiPropertyOptional({ nullable: true })
  releaseNotes!: string | null;

  @ApiProperty()
  isForceUpdate!: boolean;

  @ApiProperty()
  isSoftUpdate!: boolean;

  @ApiProperty()
  publishedAt!: Date;

  @ApiProperty()
  isDeprecated!: boolean;

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty()
  updatedAt!: Date;
}

export class VersionCompatibilityResponseDto {
  @ApiProperty({ enum: AppPlatform })
  platform!: AppPlatform;

  @ApiProperty()
  currentVersion!: string;

  @ApiProperty()
  latestVersion!: string;

  @ApiProperty()
  minSupportedVersion!: string;

  @ApiPropertyOptional({ nullable: true })
  releaseNotes!: string | null;

  @ApiProperty()
  updateAvailable!: boolean;

  @ApiProperty()
  forceUpdate!: boolean;

  @ApiProperty()
  softUpdate!: boolean;

  @ApiProperty()
  isSupported!: boolean;
}
