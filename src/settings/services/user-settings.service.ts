import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { UserSettingsRepository } from '../repositories/user-settings.repository';
import { UserSettings, VisibilityType } from '../entities/user-settings.entity';
import { authenticator } from 'otplib';

@Injectable()
export class UserSettingsService {
  constructor(private readonly repository: UserSettingsRepository) {}

  async getSettings(userId: string): Promise<UserSettings> {
    const settings = await this.repository.findByUserId(userId);
    if (!settings) {
      // Auto-create on demand if not found (lazy creation)
      return this.repository.create(UserSettings.createDefault(userId));
    }
    return settings;
  }

  async updateSettings(userId: string, data: Partial<UserSettings>): Promise<UserSettings> {
    const settings = await this.getSettings(userId);
    
    // Merge updates
    if (data.notificationPreferences) {
      settings.notificationPreferences = {
        ...settings.notificationPreferences,
        ...data.notificationPreferences,
      };
    }
    
    if (data.privacySettings) {
      settings.privacySettings = {
        ...settings.privacySettings,
        ...data.privacySettings,
      };
    }

    if (data.theme) settings.theme = data.theme;
    if (data.language) settings.language = data.language;
    if (data.timezone) settings.timezone = data.timezone;

    return this.repository.save(settings);
  }

  async resetSettings(userId: string): Promise<UserSettings> {
    await this.repository.deleteByUserId(userId);
    return this.repository.create(UserSettings.createDefault(userId));
  }

  async enable2FA(userId: string): Promise<{ secret: string; otpauthUrl: string }> {
    const settings = await this.getSettings(userId);
    if (settings.twoFactorEnabled) {
      throw new BadRequestException('2FA is already enabled');
    }

    const secret = authenticator.generateSecret();
    const otpauthUrl = authenticator.keyuri(userId, 'WhsprStellar', secret);

    settings.twoFactorSecret = secret;
    await this.repository.save(settings);

    return { secret, otpauthUrl };
  }

  async confirm2FA(userId: string, token: string): Promise<void> {
    const settings = await this.getSettings(userId);
    if (!settings.twoFactorSecret) {
      throw new BadRequestException('2FA setup not initiated');
    }

    const isValid = authenticator.check(token, settings.twoFactorSecret);
    if (!isValid) {
      throw new BadRequestException('Invalid TOTP token');
    }

    settings.twoFactorEnabled = true;
    await this.repository.save(settings);
  }

  async disable2FA(userId: string, token: string): Promise<void> {
    const settings = await this.getSettings(userId);
    if (!settings.twoFactorEnabled || !settings.twoFactorSecret) {
      throw new BadRequestException('2FA is not enabled');
    }

    const isValid = authenticator.check(token, settings.twoFactorSecret);
    if (!isValid) {
      throw new BadRequestException('Invalid TOTP token');
    }

    settings.twoFactorEnabled = false;
    settings.twoFactorSecret = null;
    await this.repository.save(settings);
  }
}
