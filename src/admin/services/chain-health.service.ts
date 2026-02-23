import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThanOrEqual } from 'typeorm';
import { Cron } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ethers } from 'ethers';

import { ChainService } from '../../chain/chain.service';
import { SupportedChain } from '../../chain/enums/supported-chain.enum';
import { RedisService } from '../../redis/redis.service';
import { ChainHealthRecord } from '../entities/chain-health-record.entity';
import { ChainHealthStatus } from '../enums/chain-health-status.enum';
import { ADMIN_STREAM_EVENTS } from '../gateways/admin-event-stream.gateway';

const LATENCY_WARN_MS = 500;
const BLOCK_AGE_WARN_S = 30;
const BLOCK_AGE_DOWN_S = 120;
const REDIS_KEY_PREFIX = 'admin:chain:health:';
const REDIS_TTL_S = 120;
const HISTORY_HOURS = 24;
const CLEANUP_OLDER_THAN_HOURS = 25; // keep a 1h buffer

export interface ChainHealthResult {
  chain: string;
  rpcUrl: string;
  status: ChainHealthStatus;
  latencyMs: number | null;
  blockNumber: number | null;
  blockAge: number | null;
  paymasterBalance: string | null;
  paymasterBalanceWarning: boolean;
  lastCheckedAt: string;
}

@Injectable()
export class ChainHealthService {
  private readonly logger = new Logger(ChainHealthService.name);
  private readonly paymasterAddress: string | null;
  private readonly balanceWarnThreshold: number;

  constructor(
    @InjectRepository(ChainHealthRecord)
    private readonly healthRecordRepository: Repository<ChainHealthRecord>,
    private readonly chainService: ChainService,
    private readonly redisService: RedisService,
    private readonly eventEmitter: EventEmitter2,
    private readonly configService: ConfigService,
  ) {
    // Resolve paymaster address (explicit env var OR derived from EVM_PRIVATE_KEY)
    const explicit = this.configService.get<string>('PAYMASTER_ADDRESS');
    if (explicit) {
      this.paymasterAddress = explicit;
    } else {
      const pk = this.configService.get<string>('EVM_PRIVATE_KEY');
      if (pk) {
        try {
          this.paymasterAddress = new ethers.Wallet(pk).address;
        } catch {
          this.paymasterAddress = null;
        }
      } else {
        this.paymasterAddress = null;
      }
    }

    const rawThreshold = this.configService.get<string>(
      'PAYMASTER_BALANCE_WARN_THRESHOLD',
    );
    this.balanceWarnThreshold = rawThreshold ? parseFloat(rawThreshold) : 0.1;
  }

  // ─── Cron: every 30 seconds ──────────────────────────────────────────────

  @Cron('*/30 * * * * *')
  async checkAllChains(): Promise<void> {
    const chains = this.chainService.getAllChains();
    await Promise.allSettled(
      chains.map(({ chain }) => this.checkAndPersist(chain)),
    );
    // Prune history older than retention window
    await this.pruneOldRecords();
  }

  // ─── Public API ──────────────────────────────────────────────────────────

  /**
   * Read current health for all chains from Redis.
   * Returns stale data if Redis is populated; returns null per chain if no data yet.
   */
  async getCurrentHealth(): Promise<Record<string, ChainHealthResult | null>> {
    const chains = this.chainService.getAllChains();
    const result: Record<string, ChainHealthResult | null> = {};

    await Promise.all(
      chains.map(async ({ chain }) => {
        const raw = await this.redisService.get(`${REDIS_KEY_PREFIX}${chain}`);
        result[chain] = raw ? (JSON.parse(raw) as ChainHealthResult) : null;
      }),
    );

    return result;
  }

  /**
   * Return last 24h of health check records, optionally filtered to one chain.
   */
  async getHealthHistory(
    chain?: SupportedChain,
  ): Promise<ChainHealthRecord[]> {
    const since = new Date(
      Date.now() - HISTORY_HOURS * 60 * 60 * 1000,
    );

    const where: Record<string, any> = { checkedAt: MoreThanOrEqual(since) };
    if (chain) {
      where.chain = chain;
    }

    return this.healthRecordRepository.find({
      where,
      order: { checkedAt: 'DESC' },
    });
  }

  // ─── Health classification (pure / testable) ─────────────────────────────

  classifyHealth(
    latencyMs: number | null,
    blockAge: number | null,
  ): ChainHealthStatus {
    // No RPC response at all
    if (latencyMs === null) {
      return ChainHealthStatus.DOWN;
    }
    // Block is too old → down regardless of latency
    if (blockAge !== null && blockAge > BLOCK_AGE_DOWN_S) {
      return ChainHealthStatus.DOWN;
    }
    // Slow RPC or block starting to age → degraded
    if (
      latencyMs > LATENCY_WARN_MS ||
      (blockAge !== null && blockAge >= BLOCK_AGE_WARN_S)
    ) {
      return ChainHealthStatus.DEGRADED;
    }
    return ChainHealthStatus.HEALTHY;
  }

  // ─── Internal ────────────────────────────────────────────────────────────

  private async checkAndPersist(chain: SupportedChain): Promise<void> {
    const config = this.chainService.getChainConfig(chain);
    const provider = this.chainService.getProvider(chain);
    const start = Date.now();

    let latencyMs: number | null = null;
    let blockNumber: number | null = null;
    let blockAge: number | null = null;

    try {
      const block = await Promise.race([
        provider.getBlock('latest'),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('RPC timeout')), 10_000),
        ),
      ]);

      latencyMs = Date.now() - start;

      if (block) {
        blockNumber = block.number;
        const nowSec = Math.floor(Date.now() / 1000);
        blockAge = nowSec - block.timestamp;
      }
    } catch (err) {
      this.logger.warn(
        `Chain ${chain} health check failed: ${(err as Error).message}`,
      );
      // latencyMs remains null → DOWN
    }

    const status = this.classifyHealth(latencyMs, blockAge);

    // Paymaster balance
    let paymasterBalance: string | null = null;
    let paymasterBalanceWarning = false;

    if (this.paymasterAddress && latencyMs !== null) {
      try {
        const raw = await provider.getBalance(this.paymasterAddress);
        const formatted = parseFloat(ethers.formatEther(raw));
        paymasterBalance = formatted.toFixed(6);
        paymasterBalanceWarning = formatted < this.balanceWarnThreshold;
      } catch (err) {
        this.logger.warn(
          `Could not fetch paymaster balance on ${chain}: ${(err as Error).message}`,
        );
      }
    }

    const result: ChainHealthResult = {
      chain,
      rpcUrl: config.rpcUrl,
      status,
      latencyMs,
      blockNumber,
      blockAge,
      paymasterBalance,
      paymasterBalanceWarning,
      lastCheckedAt: new Date().toISOString(),
    };

    // Persist to Redis
    await this.redisService.set(
      `${REDIS_KEY_PREFIX}${chain}`,
      JSON.stringify(result),
      REDIS_TTL_S,
    );

    // Persist to DB for history
    await this.healthRecordRepository.save(
      this.healthRecordRepository.create({
        chain,
        status,
        latencyMs,
        blockNumber,
        blockAge,
        paymasterBalance,
        paymasterBalanceWarning,
      }),
    );

    // Emit WebSocket security alert if paymaster balance is low
    if (paymasterBalanceWarning) {
      this.eventEmitter.emit(ADMIN_STREAM_EVENTS.SECURITY_ALERT, {
        type: 'security.alert',
        timestamp: new Date().toISOString(),
        entity: {
          alertType: 'low_paymaster_balance',
          chain,
          details: `Paymaster balance on ${chain} is ${paymasterBalance} ETH — below threshold of ${this.balanceWarnThreshold}`,
          paymasterBalance,
          threshold: String(this.balanceWarnThreshold),
        },
      });
    }
  }

  private async pruneOldRecords(): Promise<void> {
    try {
      const cutoff = new Date(
        Date.now() - CLEANUP_OLDER_THAN_HOURS * 60 * 60 * 1000,
      );
      await this.healthRecordRepository
        .createQueryBuilder()
        .delete()
        .from(ChainHealthRecord)
        .where('checkedAt < :cutoff', { cutoff })
        .execute();
    } catch (err) {
      this.logger.warn(
        `Failed to prune chain health records: ${(err as Error).message}`,
      );
    }
  }
}
