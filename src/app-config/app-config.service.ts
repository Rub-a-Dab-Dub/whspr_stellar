import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { DataSource } from 'typeorm';
import { CacheService } from '../cache/cache.service';
import { AuditLogService } from '../audit-log/audit-log.service';
import { AuditAction } from '../audit-log/constants/audit-actions';
import { APP_CONFIG_DEFAULTS, validateConfigValue } from './default-config.registry';
import { AppConfigRepository } from './app-config.repository';
import { AppConfig } from './entities/app-config.entity';
import {
  APP_CONFIG_CACHE_TTL_SECONDS,
  APP_CONFIG_SNAPSHOT_CACHE_KEY,
} from './constants';
import type { AppConfigValueType } from './constants';
import { AdminConfigGateway } from './admin-config.gateway';
import {
  AppConfigEntryDto,
  AppConfigMapResponseDto,
  PublicAppConfigResponseDto,
} from './dto/app-config-response.dto';

export interface MergedConfigEntry {
  value: unknown;
  valueType: AppConfigValueType;
  description: string | null;
  isPublic: boolean;
  updatedBy: string | null;
  updatedAt: Date | null;
}

export interface AuditContext {
  actorId: string;
  ipAddress: string | null;
  userAgent: string | null;
}

@Injectable()
export class AppConfigService implements OnModuleInit {
  private readonly logger = new Logger(AppConfigService.name);

  constructor(
    private readonly repo: AppConfigRepository,
    private readonly cache: CacheService,
    private readonly dataSource: DataSource,
    private readonly auditLog: AuditLogService,
    private readonly adminConfigGateway: AdminConfigGateway,
  ) {}

  async onModuleInit(): Promise<void> {
    try {
      for (const [key, def] of Object.entries(APP_CONFIG_DEFAULTS)) {
        const existing = await this.repo.findByKey(key);
        if (existing) continue;
        await this.repo.upsertRow({
          key,
          value: def.value,
          valueType: def.valueType,
          description: def.description,
          isPublic: def.isPublic,
          updatedBy: null,
        });
        this.logger.log(`Seeded default app_config key: ${key}`);
      }
      await this.invalidateSnapshot();
    } catch (err) {
      this.logger.error(
        `app_config seed failed: ${(err as Error).message}`,
        (err as Error).stack,
      );
    }
  }

  async getAll(): Promise<AppConfigMapResponseDto> {
    const merged = await this.getMergedMap();
    const entries: Record<string, AppConfigEntryDto> = {};
    for (const [key, e] of Object.entries(merged)) {
      entries[key] = this.toEntryDto(e);
    }
    return { entries };
  }

  async getPublicConfig(): Promise<PublicAppConfigResponseDto> {
    const merged = await this.getMergedMap();
    const values: Record<string, unknown> = {};
    for (const [key, e] of Object.entries(merged)) {
      if (!e.isPublic) continue;
      values[key] = e.value;
    }
    return { values };
  }

  async get(key: string): Promise<AppConfigEntryDto> {
    const merged = await this.getMergedMap();
    const entry = merged[key];
    if (!entry) {
      throw new NotFoundException(`Unknown config key: ${key}`);
    }
    return this.toEntryDto(entry);
  }

  async set(
    key: string,
    rawValue: unknown,
    ctx: AuditContext,
  ): Promise<AppConfigEntryDto> {
    const def = APP_CONFIG_DEFAULTS[key];
    if (!def) {
      throw new BadRequestException(`Config key is not registered: ${key}`);
    }
    validateConfigValue(key, rawValue);

    const previous = await this.getMergedMap();
    const oldVal = previous[key]?.value;

    await this.repo.upsertRow({
      key,
      value: rawValue,
      valueType: def.valueType,
      description: def.description,
      isPublic: def.isPublic,
      updatedBy: ctx.actorId,
    });

    await this.invalidateSnapshot();
    this.adminConfigGateway.notifyConfigChanged([key]);

    void this.auditLog.log({
      actorId: ctx.actorId,
      action: AuditAction.CONFIG_UPDATED,
      resource: 'app_config',
      resourceId: key,
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
      metadata: {
        key,
        previousValue: this.auditValue(key, oldVal),
        nextValue: this.auditValue(key, rawValue),
      },
    });

    return this.get(key);
  }

  async bulkSet(
    values: Record<string, unknown>,
    ctx: AuditContext,
  ): Promise<AppConfigMapResponseDto> {
    const required = new Set(Object.keys(APP_CONFIG_DEFAULTS));
    const provided = new Set(Object.keys(values));

    if (required.size !== provided.size) {
      throw new BadRequestException(
        'Bulk replace must include exactly all registered config keys',
      );
    }
    for (const k of required) {
      if (!provided.has(k)) {
        throw new BadRequestException(
          `Missing key in bulk payload: ${k}`,
        );
      }
    }
    for (const k of provided) {
      if (!required.has(k)) {
        throw new BadRequestException(`Unknown config key in bulk payload: ${k}`);
      }
    }

    const previous = await this.getMergedMap();
    const oldSnapshot: Record<string, unknown> = {};
    for (const k of required) {
      oldSnapshot[k] = previous[k]?.value;
    }

    await this.dataSource.transaction(async (manager) => {
      const entRepo = manager.getRepository(AppConfig);
      for (const key of [...required].sort()) {
        const rawValue = values[key];
        validateConfigValue(key, rawValue);
        const def = APP_CONFIG_DEFAULTS[key];
        await entRepo.upsert(
          {
            key,
            value: rawValue,
            valueType: def.valueType,
            description: def.description,
            isPublic: def.isPublic,
            updatedBy: ctx.actorId,
            updatedAt: new Date(),
          },
          ['key'],
        );
      }
    });

    await this.invalidateSnapshot();
    this.adminConfigGateway.notifyConfigChanged([...required]);

    void this.auditLog.log({
      actorId: ctx.actorId,
      action: AuditAction.CONFIG_BULK_UPDATED,
      resource: 'app_config',
      resourceId: null,
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
      metadata: {
        keys: [...required].sort(),
        previous: this.auditBulkSnapshot(oldSnapshot),
        next: this.auditBulkSnapshot(
          Object.fromEntries(
            [...required].map((k) => [k, values[k]] as const),
          ) as Record<string, unknown>,
        ),
      },
    });

    return this.getAll();
  }

  async deleteKey(key: string, ctx: AuditContext): Promise<void> {
    const existing = await this.repo.findByKey(key);
    if (!existing) {
      throw new NotFoundException(`No stored override for key: ${key}`);
    }
    const oldVal = existing.value;

    await this.repo.deleteByKey(key);
    await this.invalidateSnapshot();
    this.adminConfigGateway.notifyConfigChanged([key]);

    void this.auditLog.log({
      actorId: ctx.actorId,
      action: AuditAction.CONFIG_DELETED,
      resource: 'app_config',
      resourceId: key,
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
      metadata: {
        key,
        removedValue: this.auditValue(key, oldVal),
      },
    });
  }

  async resetToDefault(ctx: AuditContext): Promise<AppConfigMapResponseDto> {
    const keys = Object.keys(APP_CONFIG_DEFAULTS);

    await this.dataSource.transaction(async (manager) => {
      const entRepo = manager.getRepository(AppConfig);
      for (const key of keys) {
        const def = APP_CONFIG_DEFAULTS[key];
        await entRepo.upsert(
          {
            key,
            value: def.value,
            valueType: def.valueType,
            description: def.description,
            isPublic: def.isPublic,
            updatedBy: ctx.actorId,
            updatedAt: new Date(),
          },
          ['key'],
        );
      }
    });

    await this.invalidateSnapshot();
    this.adminConfigGateway.notifyConfigChanged(keys);

    void this.auditLog.log({
      actorId: ctx.actorId,
      action: AuditAction.CONFIG_RESET,
      resource: 'app_config',
      resourceId: null,
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
      metadata: { keys },
    });

    return this.getAll();
  }

  private async getMergedMap(): Promise<Record<string, MergedConfigEntry>> {
    const snapshot = await this.loadSnapshot();
    return snapshot;
  }

  private async loadSnapshot(): Promise<Record<string, MergedConfigEntry>> {
    const cached = await this.cache.get<Record<string, MergedConfigEntry>>(
      APP_CONFIG_SNAPSHOT_CACHE_KEY,
    );
    if (cached) {
      this.hydrateDates(cached);
      return cached;
    }

    const rows = await this.repo.findAll();
    const built = this.buildMerged(rows);
    await this.cache.set(
      APP_CONFIG_SNAPSHOT_CACHE_KEY,
      built,
      APP_CONFIG_CACHE_TTL_SECONDS,
    );
    return built;
  }

  /** JSON round-trip drops Date — rehydrate for DTOs */
  private hydrateDates(map: Record<string, MergedConfigEntry>): void {
    for (const e of Object.values(map)) {
      if (e.updatedAt && typeof e.updatedAt === 'string') {
        e.updatedAt = new Date(e.updatedAt as unknown as string);
      }
    }
  }

  private buildMerged(rows: AppConfig[]): Record<string, MergedConfigEntry> {
    const byKey = new Map(rows.map((r) => [r.key, r]));

    const merged: Record<string, MergedConfigEntry> = {};

    for (const [key, def] of Object.entries(APP_CONFIG_DEFAULTS)) {
      const row = byKey.get(key);
      byKey.delete(key);
      merged[key] = row ? this.fromRow(row) : this.fromDefault(key, def);
    }

    for (const [key, row] of byKey) {
      merged[key] = this.fromRow(row);
    }

    return merged;
  }

  private fromDefault(
    key: string,
    def: (typeof APP_CONFIG_DEFAULTS)[string],
  ): MergedConfigEntry {
    return {
      value: def.value,
      valueType: def.valueType,
      description: def.description,
      isPublic: def.isPublic,
      updatedBy: null,
      updatedAt: null,
    };
  }

  private fromRow(row: AppConfig): MergedConfigEntry {
    return {
      value: row.value,
      valueType: row.valueType,
      description: row.description,
      isPublic: row.isPublic,
      updatedBy: row.updatedBy,
      updatedAt: row.updatedAt,
    };
  }

  private toEntryDto(e: MergedConfigEntry): AppConfigEntryDto {
    const at = e.updatedAt
      ? e.updatedAt instanceof Date
        ? e.updatedAt
        : new Date(e.updatedAt as unknown as string)
      : new Date(0);
    return {
      value: e.value,
      valueType: e.valueType,
      description: e.description,
      isPublic: e.isPublic,
      updatedBy: e.updatedBy,
      updatedAt: at.toISOString(),
    };
  }

  private async invalidateSnapshot(): Promise<void> {
    await this.cache.del(APP_CONFIG_SNAPSHOT_CACHE_KEY);
  }

  private auditValue(key: string, v: unknown): unknown {
    if (APP_CONFIG_DEFAULTS[key]?.isPublic === false) {
      return '[REDACTED]';
    }
    return v;
  }

  private auditBulkSnapshot(m: Record<string, unknown>): Record<string, unknown> {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(m)) {
      out[k] = this.auditValue(k, v);
    }
    return out;
  }
}
