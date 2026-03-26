import { ApiProperty } from '@nestjs/swagger';
import { NotificationPreferences, PrivacySettings } from '../entities/user-settings.entity';

export class UserSettingsResponseDto {
  @ApiProperty()
  userId!: string;

  @ApiProperty({ type: 'object' })
  notificationPreferences!: NotificationPreferences;

  @ApiProperty({ type: 'object' })
  privacySettings!: PrivacySettings;

  @ApiProperty()
  theme!: string;

  @ApiProperty()
  language!: string;

  @ApiProperty()
  timezone!: string;

  @ApiProperty()
  twoFactorEnabled!: boolean;

  @ApiProperty()
  updatedAt!: Date;
}
