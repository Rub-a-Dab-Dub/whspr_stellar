import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SystemSetting } from '../admin/entities/system-setting.entity';

export const INVITE_MODE_SETTING_KEY = 'invite_mode_enabled';

/** Feature-flag read-through cache; toggles visible within this TTL (acceptance: ≤30s). */
export const INVITE_MODE_CACHE_TTL_MS = 30_000;

@Injectable()
export class InviteModeService {
  private cache: { value: boolean; at: number } | null = null;

  constructor(
    @InjectRepository(SystemSetting)
    private readonly settings: Repository<SystemSetting>,
  ) {}

  async isInviteModeEnabled(): Promise<boolean> {
    const now = Date.now();
    if (this.cache && now - this.cache.at < INVITE_MODE_CACHE_TTL_MS) {
      return this.cache.value;
    }
    const row = await this.settings.findOne({ where: { key: INVITE_MODE_SETTING_KEY } });
    const value = row?.value === 'true';
    this.cache = { value, at: now };
    return value;
  }

  async setInviteModeEnabled(enabled: boolean): Promise<void> {
    let row = await this.settings.findOne({ where: { key: INVITE_MODE_SETTING_KEY } });
    if (!row) {
      row = this.settings.create({
        key: INVITE_MODE_SETTING_KEY,
        value: enabled ? 'true' : 'false',
        description: 'When true, new registrations require a valid platform invite code',
      });
    } else {
      row.value = enabled ? 'true' : 'false';
    }
    await this.settings.save(row);
    this.invalidateCache();
  }

  invalidateCache(): void {
    this.cache = null;
  }
}
