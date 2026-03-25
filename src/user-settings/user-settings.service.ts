import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
import { createHmac, randomBytes } from 'crypto';
import { UserSettingsRepository } from './user-settings.repository';
import {
  NotificationPreferences,
  PrivacySettings,
  UserSettings,
} from './entities/user-settings.entity';
import {
  TwoFactorDisableDto,
  TwoFactorEnableDto,
  UpdateUserSettingsDto,
} from './dto/update-user-settings.dto';
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
  constructor(private readonly repository: UserSettingsRepository) {}

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
    return this.toResponse(settings);
  }

  async updateSettings(
    userId: string,
    updateDto: UpdateUserSettingsDto,
  ): Promise<UserSettingsResponseDto> {
    const settings = await this.ensureSettingsForUser(userId);

    Object.assign(settings, updateDto);
    const saved = await this.repository.save(settings);
    return this.toResponse(saved);
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

    return this.toResponse(await this.repository.save(settings));
  }

  async enable2FA(
    userId: string,
    dto: TwoFactorEnableDto,
  ): Promise<{ secret?: string; otpauthUrl?: string; twoFactorEnabled: boolean }> {
    const settings = await this.ensureSettingsForUser(userId);

    if (!settings.twoFactorSecret) {
      const secret = this.generateTotpSecret();
      settings.twoFactorSecret = secret;
      settings.twoFactorEnabled = false;
      await this.repository.save(settings);
      return {
        secret,
        otpauthUrl: `otpauth://totp/GaslessGossip:${userId}?secret=${secret}&issuer=GaslessGossip`,
        twoFactorEnabled: false,
      };
    }

    if (!dto.code) {
      throw new BadRequestException('TOTP code is required to enable 2FA');
    }

    if (!this.verifyTotpCode(settings.twoFactorSecret, dto.code)) {
      throw new UnauthorizedException('Invalid TOTP code');
    }

    settings.twoFactorEnabled = true;
    await this.repository.save(settings);
    return { twoFactorEnabled: true };
  }

  async disable2FA(userId: string, dto: TwoFactorDisableDto): Promise<void> {
    const settings = await this.ensureSettingsForUser(userId);
    if (!settings.twoFactorEnabled) {
      return;
    }

    if (!settings.twoFactorSecret || !dto.code) {
      throw new BadRequestException('TOTP code is required to disable 2FA');
    }

    if (!this.verifyTotpCode(settings.twoFactorSecret, dto.code)) {
      throw new UnauthorizedException('Invalid TOTP code');
    }

    settings.twoFactorEnabled = false;
    settings.twoFactorSecret = null;
    await this.repository.save(settings);
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

  private toResponse(settings: UserSettings): UserSettingsResponseDto {
    return {
      userId: settings.userId,
      notificationPreferences: settings.notificationPreferences,
      privacySettings: settings.privacySettings,
      theme: settings.theme,
      language: settings.language,
      timezone: settings.timezone,
      twoFactorEnabled: settings.twoFactorEnabled,
      updatedAt: settings.updatedAt,
    };
  }

  private generateTotpSecret(): string {
    return randomBytes(20).toString('hex').toUpperCase();
  }

  private verifyTotpCode(secret: string, code: string): boolean {
    const now = Math.floor(Date.now() / 1000);
    const window = 1;
    for (let offset = -window; offset <= window; offset += 1) {
      const candidate = this.generateTotp(secret, now + offset * 30);
      if (candidate === code) {
        return true;
      }
    }
    return false;
  }

  private generateTotp(secret: string, timestamp: number): string {
    const counter = Math.floor(timestamp / 30);
    const counterBuffer = Buffer.alloc(8);
    counterBuffer.writeBigUInt64BE(BigInt(counter));
    const hmac = createHmac('sha1', Buffer.from(secret, 'hex')).update(counterBuffer).digest();
    const offset = hmac[hmac.length - 1] & 0xf;
    const binary =
      ((hmac[offset] & 0x7f) << 24) |
      ((hmac[offset + 1] & 0xff) << 16) |
      ((hmac[offset + 2] & 0xff) << 8) |
      (hmac[offset + 3] & 0xff);
    return String(binary % 1_000_000).padStart(6, '0');
  }
}
