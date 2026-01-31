import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Request } from 'express';
import { createHash } from 'crypto';
import { CacheService } from '../cache/cache.service';
import { SystemConfig } from './entities/system-config.entity';
import { SystemConfigVersion } from './entities/system-config-version.entity';
import {
  SystemConfigAudit,
  SystemConfigAuditAction,
} from './entities/system-config-audit.entity';
import { FeatureFlagConfig, FeatureFlagVariant } from './interfaces/feature-flag.interface';
import { SystemConfigUpdateItemDto } from './dto/system-config-update.dto';

const CONFIG_CACHE_KEY = 'system_config:all';
const CONFIG_ITEM_KEY_PREFIX = 'system_config:item:';
const GLOBAL_KILL_SWITCH_KEY = 'system.kill_switch';

@Injectable()
export class SystemConfigService {
  private readonly cacheTtlSeconds = 60;

  constructor(
    @InjectRepository(SystemConfig)
    private readonly configRepository: Repository<SystemConfig>,
    @InjectRepository(SystemConfigVersion)
    private readonly versionRepository: Repository<SystemConfigVersion>,
    @InjectRepository(SystemConfigAudit)
    private readonly auditRepository: Repository<SystemConfigAudit>,
    private readonly cacheService: CacheService,
  ) {}

  async getAllConfigs(isFeatureFlag?: boolean): Promise<SystemConfig[]> {
    const cacheKey =
      isFeatureFlag === undefined
        ? CONFIG_CACHE_KEY
        : `${CONFIG_CACHE_KEY}:${isFeatureFlag ? 'flags' : 'configs'}`;

    return this.cacheService.wrap(
      cacheKey,
      async () => {
        if (isFeatureFlag === undefined) {
          return this.configRepository.find({ order: { key: 'ASC' } });
        }
        return this.configRepository.find({
          where: { isFeatureFlag },
          order: { key: 'ASC' },
        });
      },
      this.cacheTtlSeconds,
    );
  }

  async getConfig(key: string): Promise<SystemConfig | null> {
    const cacheKey = `${CONFIG_ITEM_KEY_PREFIX}${key}`;
    return this.cacheService.wrap(
      cacheKey,
      async () => {
        const config = await this.configRepository.findOne({ where: { key } });
        return config || null;
      },
      this.cacheTtlSeconds,
    );
  }

  async updateConfigs(
    updates: SystemConfigUpdateItemDto[],
    adminId: string | null,
    req?: Request,
  ): Promise<SystemConfig[]> {
    const results: SystemConfig[] = [];

    for (const update of updates) {
      const existing = await this.configRepository.findOne({
        where: { key: update.key },
      });

      if (!existing) {
        const created = this.configRepository.create({
          key: update.key,
          value: update.value,
          description: update.description || null,
          isFeatureFlag: update.isFeatureFlag ?? false,
          version: 1,
          createdBy: adminId,
          updatedBy: adminId,
        });

        const saved = await this.configRepository.save(created);
        await this.saveVersion(saved, adminId);
        await this.saveAudit({
          configId: saved.id,
          key: saved.key,
          action:
            saved.key === GLOBAL_KILL_SWITCH_KEY
              ? SystemConfigAuditAction.KILL_SWITCH
              : SystemConfigAuditAction.CREATED,
          oldValue: null,
          newValue: saved.value,
          adminId,
          req,
        });

        await this.invalidateCaches(saved.key);
        results.push(saved);
        continue;
      }

      const previousValue = existing.value;
      existing.value = update.value;
      existing.description = update.description ?? existing.description;
      existing.isFeatureFlag =
        update.isFeatureFlag === undefined ? existing.isFeatureFlag : update.isFeatureFlag;
      existing.version = existing.version + 1;
      existing.updatedBy = adminId;

      const saved = await this.configRepository.save(existing);
      await this.saveVersion(saved, adminId);
      await this.saveAudit({
        configId: saved.id,
        key: saved.key,
        action:
          saved.key === GLOBAL_KILL_SWITCH_KEY
            ? SystemConfigAuditAction.KILL_SWITCH
            : SystemConfigAuditAction.UPDATED,
        oldValue: previousValue,
        newValue: saved.value,
        adminId,
        req,
      });

      await this.invalidateCaches(saved.key);
      results.push(saved);
    }

    return results;
  }

  async rollbackConfig(
    key: string,
    version: number,
    adminId: string | null,
    req?: Request,
  ): Promise<SystemConfig> {
    const config = await this.configRepository.findOne({ where: { key } });
    if (!config) {
      throw new NotFoundException(`Config with key ${key} not found`);
    }

    const targetVersion = await this.versionRepository.findOne({
      where: { configId: config.id, version },
    });

    if (!targetVersion) {
      throw new NotFoundException(`Version ${version} not found for config ${key}`);
    }

    const previousValue = config.value;
    config.value = targetVersion.value;
    config.version = config.version + 1;
    config.updatedBy = adminId;

    const saved = await this.configRepository.save(config);
    await this.saveVersion(saved, adminId);
    await this.saveAudit({
      configId: saved.id,
      key: saved.key,
      action: SystemConfigAuditAction.ROLLED_BACK,
      oldValue: previousValue,
      newValue: saved.value,
      adminId,
      metadata: { fromVersion: version, toVersion: saved.version },
      req,
    });

    await this.invalidateCaches(saved.key);
    return saved;
  }

  async isFeatureEnabled(flagKey: string, userId?: string | null): Promise<boolean> {
    if (await this.isKillSwitchEnabled()) {
      return false;
    }

    const config = await this.getConfig(flagKey);
    if (!config || !config.isFeatureFlag) {
      return false;
    }

    const flag = this.normalizeFlagConfig(config.value);
    if (flag.killSwitch) {
      return false;
    }

    if (!flag.enabled) {
      return false;
    }

    if (userId && flag.excludedUsers?.includes(userId)) {
      return false;
    }

    if (userId && flag.targetUsers?.includes(userId)) {
      return true;
    }

    if (flag.rolloutPercent === undefined) {
      return flag.enabled;
    }

    if (!userId) {
      return flag.rolloutPercent >= 100;
    }

    const bucket = this.getDeterministicBucket(`${flagKey}:${userId}`);
    return bucket < Math.max(0, Math.min(flag.rolloutPercent, 100));
  }

  async getFeatureVariant(
    flagKey: string,
    userId?: string | null,
  ): Promise<FeatureFlagVariant | null> {
    const enabled = await this.isFeatureEnabled(flagKey, userId);
    if (!enabled) {
      return null;
    }

    const config = await this.getConfig(flagKey);
    if (!config) {
      return null;
    }

    const flag = this.normalizeFlagConfig(config.value);
    if (!flag.variants || flag.variants.length === 0) {
      return { name: 'control', weight: 100 };
    }

    const variants = flag.variants.filter((variant) => variant.weight > 0);
    const totalWeight = variants.reduce((sum, variant) => sum + variant.weight, 0);
    if (totalWeight <= 0) {
      return { name: 'control', weight: 100 };
    }

    const bucket = this.getDeterministicBucket(`${flagKey}:variant:${userId || 'anon'}`);
    const scaledBucket = (bucket / 100) * totalWeight;
    let cumulative = 0;

    for (const variant of variants) {
      cumulative += variant.weight;
      if (scaledBucket < cumulative) {
        return variant;
      }
    }

    return variants[variants.length - 1];
  }

  async getAuditTrail(key?: string): Promise<SystemConfigAudit[]> {
    return this.auditRepository.find({
      where: key ? { key } : {},
      order: { createdAt: 'DESC' },
      take: 100,
    });
  }

  private async saveVersion(config: SystemConfig, adminId: string | null) {
    const versionEntry = this.versionRepository.create({
      configId: config.id,
      key: config.key,
      version: config.version,
      value: config.value,
      createdBy: adminId,
    });
    await this.versionRepository.save(versionEntry);
  }

  private async saveAudit(params: {
    configId: string | null;
    key: string;
    action: SystemConfigAuditAction;
    oldValue: any;
    newValue: any;
    adminId: string | null;
    metadata?: Record<string, any>;
    req?: Request;
  }) {
    const audit = this.auditRepository.create({
      configId: params.configId,
      key: params.key,
      action: params.action,
      oldValue: params.oldValue ?? null,
      newValue: params.newValue ?? null,
      metadata: params.metadata ?? null,
      adminId: params.adminId,
      ipAddress: params.req?.ip || params.req?.socket.remoteAddress || null,
      userAgent: params.req?.headers['user-agent'] || null,
    });
    await this.auditRepository.save(audit);
  }

  private async invalidateCaches(key: string): Promise<void> {
    await this.cacheService.delete(CONFIG_CACHE_KEY);
    await this.cacheService.delete(`${CONFIG_CACHE_KEY}:flags`);
    await this.cacheService.delete(`${CONFIG_CACHE_KEY}:configs`);
    await this.cacheService.delete(`${CONFIG_ITEM_KEY_PREFIX}${key}`);
  }

  private normalizeFlagConfig(value: any): FeatureFlagConfig {
    if (typeof value === 'boolean') {
      return { enabled: value };
    }

    if (!value || typeof value !== 'object') {
      return { enabled: false };
    }

    const rolloutRaw = value.rolloutPercent;
    const rolloutParsed =
      rolloutRaw === undefined ? undefined : Number(rolloutRaw);
    const rolloutPercent =
      rolloutParsed === undefined || Number.isNaN(rolloutParsed)
        ? undefined
        : rolloutParsed;

    return {
      enabled: Boolean(value.enabled),
      rolloutPercent,
      targetUsers: Array.isArray(value.targetUsers) ? value.targetUsers : undefined,
      excludedUsers: Array.isArray(value.excludedUsers) ? value.excludedUsers : undefined,
      variants: Array.isArray(value.variants) ? value.variants : undefined,
      killSwitch: Boolean(value.killSwitch),
    };
  }

  private async isKillSwitchEnabled(): Promise<boolean> {
    const killSwitch = await this.getConfig(GLOBAL_KILL_SWITCH_KEY);
    if (!killSwitch) {
      return false;
    }
    const value = killSwitch.value;
    if (typeof value === 'boolean') {
      return value;
    }
    if (value && typeof value === 'object') {
      return Boolean(value.enabled);
    }
    return false;
  }

  private getDeterministicBucket(seed: string): number {
    const hash = createHash('sha256').update(seed).digest('hex');
    const slice = hash.slice(0, 8);
    const bucket = parseInt(slice, 16) % 100;
    return bucket;
  }
}
