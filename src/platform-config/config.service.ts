import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PlatformConfig } from './entities/platform-config.entity';
import Redis from 'ioredis';

const REQUIRED_KEYS = [
  'xp_multiplier',
  'platform_fee_percentage',
  'allowed_reactions',
  'rate_limit_messages_per_minute',
  'feature_flags',
];

@Injectable()
export class ConfigService implements OnModuleInit {
  private readonly logger = new Logger(ConfigService.name);
  private redis: Redis;
  private readonly CACHE_PREFIX = 'config:';
  private readonly CACHE_TTL = 3600;

  constructor(
    @InjectRepository(PlatformConfig)
    private configRepo: Repository<PlatformConfig>,
  ) {
    this.redis = new Redis({
      host: process.env.REDIS_HOST ?? 'localhost',
      port: parseInt(process.env.REDIS_PORT ?? '6379', 10),
    });
  }

  async onModuleInit() {
    await this.validateRequiredKeys();
  }

  private async validateRequiredKeys() {
    const missing = [];
    for (const key of REQUIRED_KEYS) {
      const exists = await this.configRepo.findOne({ where: { key } });
      if (!exists) missing.push(key);
    }
    if (missing.length > 0) {
      throw new Error(`Missing required config keys: ${missing.join(', ')}`);
    }
    this.logger.log('All required config keys validated');
  }

  async get<T = any>(key: string): Promise<T | null> {
    const cached = await this.redis.get(this.CACHE_PREFIX + key);
    if (cached) {
      return JSON.parse(cached);
    }

    const config = await this.configRepo.findOne({ where: { key } });
    if (!config) return null;

    await this.redis.setex(
      this.CACHE_PREFIX + key,
      this.CACHE_TTL,
      JSON.stringify(config.value),
    );

    return config.value;
  }

  async getAll(): Promise<PlatformConfig[]> {
    return this.configRepo.find({ order: { key: 'ASC' } });
  }

  async update(
    key: string,
    value: any,
    updatedBy: string,
    description?: string,
  ): Promise<PlatformConfig> {
    let config = await this.configRepo.findOne({ where: { key } });

    if (config) {
      config.value = value;
      config.updatedBy = updatedBy;
      if (description) config.description = description;
    } else {
      config = this.configRepo.create({ key, value, updatedBy, description });
    }

    const saved = await this.configRepo.save(config);
    await this.invalidateCache(key);
    await this.logChange(key, value, updatedBy);

    return saved;
  }

  private async invalidateCache(key: string) {
    await this.redis.del(this.CACHE_PREFIX + key);
    this.logger.log(`Cache invalidated for key: ${key}`);
  }

  private async logChange(key: string, value: any, updatedBy: string) {
    const logEntry = {
      key,
      value,
      updatedBy,
      timestamp: new Date().toISOString(),
    };
    await this.redis.lpush('config:audit', JSON.stringify(logEntry));
    await this.redis.ltrim('config:audit', 0, 999);
  }

  async getAuditLog(limit = 50): Promise<any[]> {
    const logs = await this.redis.lrange('config:audit', 0, limit - 1);
    return logs.map((log) => JSON.parse(log));
  }
}
