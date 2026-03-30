import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CacheService } from '../cache/cache.service';
import { SorobanClientService } from '../soroban/services/soroban-client/soroban-client.service';
import { UserRegistryContractService } from '../soroban/services/user-registry-contract/user-registry-contract.service';
import { User } from '../users/entities/user.entity';
import { ContractStateKeyType } from './contract-state-key-type.enum';
import { ContractStateCacheEntry } from './entities/contract-state-cache-entry.entity';
import { ContractStateCacheMetricsService } from './contract-state-cache-metrics.service';
import { redisContractPattern, redisEntryKey } from './contract-state-cache.redis-keys';

export type CachedContractState = {
  value: unknown;
  ledger: number;
  cachedAt: string;
  keyType: ContractStateKeyType;
};

export type ContractStateCacheGetResult = {
  value: unknown;
  ledger: number;
  cachedAt: Date;
  source: 'redis' | 'postgres';
  stale: boolean;
  keyType: ContractStateKeyType;
};

type RedisEnvelope = {
  v: unknown;
  ledger: number;
  cachedAt: string;
  keyType: ContractStateKeyType;
  contractAddress: string;
  stateKey: string;
};

@Injectable()
export class ContractStateCacheService {
  private readonly logger = new Logger(ContractStateCacheService.name);

  constructor(
    @InjectRepository(ContractStateCacheEntry)
    private readonly entryRepo: Repository<ContractStateCacheEntry>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    private readonly cache: CacheService,
    private readonly metrics: ContractStateCacheMetricsService,
    private readonly sorobanClient: SorobanClientService,
    private readonly userRegistry: UserRegistryContractService,
    private readonly config: ConfigService,
  ) {}

  private staleLedgerDelta(): number {
    return parseInt(this.config.get<string>('CONTRACT_CACHE_STALE_LEDGER_DELTA', '3'), 10);
  }

  private async currentLedgerSequence(): Promise<number | null> {
    try {
      const latest = await this.sorobanClient.getServer().getLatestLedger();
      return typeof latest.sequence === 'number' ? latest.sequence : Number(latest.sequence);
    } catch (e) {
      this.logger.warn(`getLatestLedger failed: ${(e as Error).message}`);
      return null;
    }
  }

  private isStale(entryLedger: number, latest: number | null): boolean {
    if (latest === null) return false;
    return latest - entryLedger >= this.staleLedgerDelta();
  }

  async get(
    contractAddress: string,
    stateKey: string,
    keyTypeHint: ContractStateKeyType = ContractStateKeyType.KEY_RECORD,
  ): Promise<ContractStateCacheGetResult | null> {
    const latest = await this.currentLedgerSequence();
    const rKey = redisEntryKey(contractAddress, stateKey);
    const redisRaw = await this.cache.get<RedisEnvelope>(rKey);
    if (redisRaw && redisRaw.contractAddress === contractAddress && redisRaw.stateKey === stateKey) {
      this.metrics.recordHit(contractAddress, redisRaw.keyType);
      return {
        value: redisRaw.v,
        ledger: redisRaw.ledger,
        cachedAt: new Date(redisRaw.cachedAt),
        source: 'redis',
        stale: this.isStale(redisRaw.ledger, latest),
        keyType: redisRaw.keyType,
      };
    }

    const row = await this.entryRepo.findOne({
      where: { contractAddress, stateKey },
    });
    if (!row) {
      this.metrics.recordMiss(contractAddress, keyTypeHint);
      return null;
    }

    this.metrics.recordHit(contractAddress, row.keyType);
    const ledgerNum = Number(row.ledger);
    await this.writeRedisFromRow(contractAddress, stateKey, row);

    return {
      value: row.stateValue,
      ledger: ledgerNum,
      cachedAt: row.cachedAt,
      source: 'postgres',
      stale: this.isStale(ledgerNum, latest),
      keyType: row.keyType,
    };
  }

  async set(
    contractAddress: string,
    stateKey: string,
    keyType: ContractStateKeyType,
    stateValue: unknown,
    ledger: number,
    ttlSeconds = 300,
  ): Promise<ContractStateCacheEntry> {
    return this.upsertFromChain(contractAddress, stateKey, keyType, stateValue, ledger, ttlSeconds);
  }

  async upsertFromChain(
    contractAddress: string,
    stateKey: string,
    keyType: ContractStateKeyType,
    stateValue: unknown,
    ledger: number,
    ttlSeconds = 300,
  ): Promise<ContractStateCacheEntry> {
    const now = new Date();
    // TypeORM DeepPartial + jsonb union is overly strict for upsert payloads.
    await this.entryRepo.upsert(
      {
        contractAddress,
        stateKey,
        keyType,
        stateValue,
        ledger: String(ledger),
        cachedAt: now,
        ttlSeconds,
      } as any,
      ['contractAddress', 'stateKey'],
    );
    const saved = await this.entryRepo.findOneOrFail({ where: { contractAddress, stateKey } });
    await this.writeRedisEnvelope(contractAddress, stateKey, {
      v: stateValue,
      ledger,
      cachedAt: now.toISOString(),
      keyType,
      contractAddress,
      stateKey,
    }, ttlSeconds);
    return saved;
  }

  /**
   * Pull fresh value via `fetcher`, persist to PG + Redis. Uses latest Soroban ledger if fetcher omits ledger.
   */
  async syncFromChain(
    contractAddress: string,
    stateKey: string,
    keyType: ContractStateKeyType,
    fetcher: () => Promise<{ value: unknown; ledger?: number }>,
    ttlSeconds = 300,
  ): Promise<ContractStateCacheEntry> {
    const { value, ledger: explicit } = await fetcher();
    const ledger =
      explicit ?? (await this.currentLedgerSequence()) ?? 0;
    return this.upsertFromChain(contractAddress, stateKey, keyType, value, ledger, ttlSeconds);
  }

  async invalidate(contractAddress: string): Promise<{ postgresRowsRemoved: number }> {
    const pattern = redisContractPattern(contractAddress);
    await this.cache.invalidatePattern(pattern);
    const res = await this.entryRepo.delete({ contractAddress });
    return { postgresRowsRemoved: res.affected ?? 0 };
  }

  /**
   * Called after new events were indexed for a contract — clears L1/L2 for that contract (within indexer poll window).
   */
  async invalidateAfterChainEvents(contractAddress: string): Promise<void> {
    await this.invalidate(contractAddress);
  }

  async bulkGet(
    items: { contractAddress: string; stateKey: string; keyTypeHint?: ContractStateKeyType }[],
  ): Promise<(ContractStateCacheGetResult | null)[]> {
    return Promise.all(
      items.map((i) => this.get(i.contractAddress, i.stateKey, i.keyTypeHint ?? ContractStateKeyType.KEY_RECORD)),
    );
  }

  async warmCache(options?: {
    userLimit?: number;
    maxDurationMs?: number;
  }): Promise<{ warmed: number; skipped: number; durationMs: number; timedOut: boolean }> {
    const userLimit = Math.min(options?.userLimit ?? 1000, 10_000);
    const maxDurationMs = Math.min(options?.maxDurationMs ?? 60_000, 120_000);
    const contractId = this.config.get<string>('USER_REGISTRY_CONTRACT_ID', '').trim();
    const started = Date.now();
    let warmed = 0;
    let skipped = 0;
    let timedOut = false;

    if (!contractId) {
      this.logger.warn('USER_REGISTRY_CONTRACT_ID not set — warmCache skipped');
      return { warmed: 0, skipped: 0, durationMs: Date.now() - started, timedOut: false };
    }

    const users = await this.userRepo.find({
      where: { isActive: true },
      order: { updatedAt: 'DESC' },
      take: userLimit,
    });

    for (const u of users) {
      if (Date.now() - started >= maxDurationMs) {
        timedOut = true;
        break;
      }
      const stateKey = `${ContractStateKeyType.USER_REGISTRY}:${u.id}`;
      try {
        const value = await this.userRegistry.getUser(u.id);
        const ledger = (await this.currentLedgerSequence()) ?? 0;
        await this.upsertFromChain(
          contractId,
          stateKey,
          ContractStateKeyType.USER_REGISTRY,
          value,
          ledger,
          parseInt(this.config.get<string>('CONTRACT_CACHE_DEFAULT_TTL_SEC', '300'), 10),
        );
        warmed++;
      } catch (e) {
        skipped++;
        this.logger.debug(`warm skip user ${u.id}: ${(e as Error).message}`);
      }
    }

    return {
      warmed,
      skipped,
      durationMs: Date.now() - started,
      timedOut,
    };
  }

  async getCacheStats(): Promise<{
    metrics: ReturnType<ContractStateCacheMetricsService['getSnapshot']>;
    postgresRowCount: number;
    staleEntryCount: number;
    latestLedger: number | null;
    staleLedgerDelta: number;
  }> {
    const latestLedger = await this.currentLedgerSequence();
    const postgresRowCount = await this.entryRepo.count();
    const staleDelta = this.staleLedgerDelta();

    let staleEntryCount = 0;
    if (latestLedger !== null) {
      const threshold = latestLedger - staleDelta;
      staleEntryCount = await this.entryRepo
        .createQueryBuilder('e')
        .where('CAST(e.ledger AS BIGINT) <= :thr', { thr: threshold })
        .getCount();
    }

    return {
      metrics: this.metrics.getSnapshot(),
      postgresRowCount,
      staleEntryCount,
      latestLedger,
      staleLedgerDelta: staleDelta,
    };
  }

  private async writeRedisFromRow(contractAddress: string, stateKey: string, row: ContractStateCacheEntry): Promise<void> {
    const ledgerNum = Number(row.ledger);
    await this.writeRedisEnvelope(
      contractAddress,
      stateKey,
      {
        v: row.stateValue,
        ledger: ledgerNum,
        cachedAt: row.cachedAt.toISOString(),
        keyType: row.keyType,
        contractAddress,
        stateKey,
      },
      row.ttlSeconds,
    );
  }

  private async writeRedisEnvelope(
    contractAddress: string,
    stateKey: string,
    env: RedisEnvelope,
    ttlSeconds: number,
  ): Promise<void> {
    const rKey = redisEntryKey(contractAddress, stateKey);
    await this.cache.set(rKey, env, ttlSeconds);
  }
}
