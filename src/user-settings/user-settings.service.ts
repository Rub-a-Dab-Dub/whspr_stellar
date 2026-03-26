import { Inject, Injectable, forwardRef } from '@nestjs/common';
import { UserSettingsRepository } from './user-settings.repository';
import {
  NotificationPreferences,
  PrivacySettings,
  UserSettings,
} from './entities/user-settings.entity';
import { UpdateUserSettingsDto } from './dto/update-user-settings.dto';
import { TwoFactorService } from '../two-factor/two-factor.service';
import { UserSettingsResponseDto } from './dto/user-settings-response.dto';

const DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreferences = {
  messages: { push: true, email: false, inApp: true },
  mentions: { push: true, email: true, inApp: true },
  system: { push: false, email: true, inApp: true },
};

const DEFAULT_PRIVACY_SETTINGS: PrivacySettings = {
  lastSeenVisibility: 'everyone',
  readReceiptsEnabled: true,
  onlineStatusVisible: true,
};

@Injectable()
export class UserSettingsService {
  constructor(
    private readonly repository: UserSettingsRepository,
    @Inject(forwardRef(() => TwoFactorService))
    private readonly twoFactorService: TwoFactorService,
  ) {}

  async ensureSettingsForUser(userId: string): Promise<UserSettings> {
    const existing = await this.repository.findByUserId(userId);
    if (existing) {
      return existing;
    }

    const settings = this.repository.create({
      userId,
      notificationPreferences: DEFAULT_NOTIFICATION_PREFERENCES,
      privacySettings: DEFAULT_PRIVACY_SETTINGS,
      theme: 'system',
      language: 'en',
      timezone: 'UTC',
      twoFactorEnabled: false,
      twoFactorSecret: null,
    });
    return this.repository.save(settings);
  }

  async getSettings(userId: string): Promise<UserSettingsResponseDto> {
    const settings = await this.ensureSettingsForUser(userId);
    const twoFactorEnabled = await this.twoFactorService.isEnabled(userId);
    return this.toResponse(settings, twoFactorEnabled);
  }

  async updateSettings(
    userId: string,
    updateDto: UpdateUserSettingsDto,
  ): Promise<UserSettingsResponseDto> {
    const settings = await this.ensureSettingsForUser(userId);

    Object.assign(settings, updateDto);
    const saved = await this.repository.save(settings);
    const twoFactorEnabled = await this.twoFactorService.isEnabled(userId);
    return this.toResponse(saved, twoFactorEnabled);
  }

  async resetSettings(userId: string): Promise<UserSettingsResponseDto> {
    const settings = await this.ensureSettingsForUser(userId);
    settings.notificationPreferences = DEFAULT_NOTIFICATION_PREFERENCES;
    settings.privacySettings = DEFAULT_PRIVACY_SETTINGS;
    settings.theme = 'system';
    settings.language = 'en';
    settings.timezone = 'UTC';
    settings.twoFactorEnabled = false;
    settings.twoFactorSecret = null;

    await this.twoFactorService.removeAllForUser(userId);

    const saved = await this.repository.save(settings);
    return this.toResponse(saved, false);
  }

  async isNotificationEnabled(
    userId: string,
    type: keyof NotificationPreferences,
    channel: keyof NotificationPreferences['messages'],
  ): Promise<boolean> {
    const settings = await this.ensureSettingsForUser(userId);
    return settings.notificationPreferences[type][channel];
  }

  async getPrivacySettings(userId: string): Promise<PrivacySettings> {
    const settings = await this.ensureSettingsForUser(userId);
    return settings.privacySettings;
  }

  private toResponse(settings: UserSettings, twoFactorEnabled: boolean): UserSettingsResponseDto {
    return {
      userId: settings.userId,
      notificationPreferences: settings.notificationPreferences,
      privacySettings: settings.privacySettings,
      theme: settings.theme,
      language: settings.language,
      timezone: settings.timezone,
      twoFactorEnabled,
      updatedAt: settings.updatedAt,
    };
  }
}
