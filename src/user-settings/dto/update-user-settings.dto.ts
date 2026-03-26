import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsIn,
  IsObject,
  IsOptional,
  IsString,
  Length,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

class NotificationChannelPreferenceDto {
  @IsBoolean()
  push!: boolean;

  @IsBoolean()
  email!: boolean;

  @IsBoolean()
  inApp!: boolean;
}

class NotificationPreferencesDto {
  @ValidateNested()
  @Type(() => NotificationChannelPreferenceDto)
  messages!: NotificationChannelPreferenceDto;

  @ValidateNested()
  @Type(() => NotificationChannelPreferenceDto)
  mentions!: NotificationChannelPreferenceDto;

  @ValidateNested()
  @Type(() => NotificationChannelPreferenceDto)
  system!: NotificationChannelPreferenceDto;
}

class PrivacySettingsDto {
  @IsIn(['everyone', 'contacts', 'nobody'])
  lastSeenVisibility!: 'everyone' | 'contacts' | 'nobody';

  @IsBoolean()
  readReceiptsEnabled!: boolean;

  @IsBoolean()
  onlineStatusVisible!: boolean;
}

export class UpdateUserSettingsDto {
  @ApiPropertyOptional()
  @IsOptional()
  @ValidateNested()
  @Type(() => NotificationPreferencesDto)
  notificationPreferences?: NotificationPreferencesDto;

  @ApiPropertyOptional()
  @IsOptional()
  @ValidateNested()
  @Type(() => PrivacySettingsDto)
  privacySettings?: PrivacySettingsDto;

  @ApiPropertyOptional()
  @IsOptional()
  @IsIn(['light', 'dark', 'system'])
  theme?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(2, 10)
  language?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(2, 60)
  timezone?: string;
}
