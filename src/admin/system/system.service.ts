import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DataSource } from 'typeorm';
import { promises as fs } from 'fs';
import { join } from 'path';
import { QueueService } from '../../queue/queue.service';
import { RedisService } from '../../redis/redis.service';
import { ChainService } from '../../chain/chain.service';
import { SupportedChain } from '../../chain/enums/supported-chain.enum';
import {
  AuditAction,
  AuditEventType,
  AuditOutcome,
  AuditSeverity,
} from '../entities/audit-log.entity';
import { AuditLogService } from '../services/audit-log.service';
import {
  SystemLogLevel,
  SystemLogsQueryDto,
} from './dto/system-logs-query.dto';
import { Request } from 'express';

type ServiceHealthStatus = 'healthy' | 'degraded' | 'unhealthy';
type OverallHealthStatus = 'healthy' | 'degraded' | 'critical';

@Injectable()
export class SystemService {
  private readonly trackedChains: SupportedChain[] = [
    SupportedChain.BASE,
    SupportedChain.BNB,
    SupportedChain.CELO,
  ];

  constructor(
    private readonly dataSource: DataSource,
    private readonly queueService: QueueService,
    private readonly redisService: RedisService,
    private readonly chainService: ChainService,
    private readonly auditLogService: AuditLogService,
  ) {}

  async getSystemHealth() {
    const [database, redis, queues, chains] = await Promise.all([
      this.getDatabaseHealth(),
      this.getRedisHealth(),
      this.getQueueHealth(),
      this.getChainHealth(),
    ]);
    const memoryUsage = process.memoryUsage();
    const memory = {
      heapUsedMb: this.toMb(memoryUsage.heapUsed),
      heapTotalMb: this.toMb(memoryUsage.heapTotal),
      rssMb: this.toMb(memoryUsage.rss),
      externalMb: this.toMb(memoryUsage.external),
    };

    const status = this.deriveOverallStatus({
      databaseStatus: database.status,
      redisStatus: redis.status,
      queueFailedCounts: Object.values(queues).map((queue) => queue.failed),
      chainStatuses: Object.values(chains).map((chain) => chain.status),
      memory,
    });

    return {
      status,
      uptime: process.uptime(),
      nodeVersion: process.version,
      services: {
        database,
        redis,
        queues,
        memory,
        chains,
      },
    };
  }

  async getQueueDetails() {
    const queueStats = await this.queueService.getAllQueueStats();
    return {
      queues: queueStats,
      totalQueues: queueStats.length,
    };
  }

  async retryAllFailed(queueName: string, actorId: string, req: Request) {
    this.assertValidQueueName(queueName);

    const queueStats = await this.queueService.getQueueStats(queueName);
    if (queueStats.failed > 500) {
      throw new BadRequestException(
        `Queue "${queueName}" has ${queueStats.failed} failed jobs. Maximum 500 retries per call.`,
      );
    }

    const result = await this.queueService.retryFailedJobs(queueName, 500);

    await this.auditLogService.createAuditLog({
      actorUserId: actorId,
      action: AuditAction.BULK_ACTION,
      eventType: AuditEventType.SYSTEM,
      outcome:
        result.errors.length === 0
          ? AuditOutcome.SUCCESS
          : AuditOutcome.PARTIAL,
      severity:
        result.errors.length === 0 ? AuditSeverity.LOW : AuditSeverity.MEDIUM,
      resourceType: 'queue',
      resourceId: queueName,
      details: `Retried failed queue jobs (attempted=${result.attempted}, retried=${result.retried})`,
      metadata: {
        operation: 'retry-all-failed',
        ...result,
      },
      req,
    });

    return result;
  }

  async clearFailed(queueName: string, actorId: string, req: Request) {
    this.assertValidQueueName(queueName);

    const result = await this.queueService.clearFailedJobs(queueName);
    await this.auditLogService.createAuditLog({
      actorUserId: actorId,
      action: AuditAction.BULK_ACTION,
      eventType: AuditEventType.SYSTEM,
      outcome: AuditOutcome.SUCCESS,
      severity: AuditSeverity.HIGH,
      resourceType: 'queue',
      resourceId: queueName,
      details: `Cleared failed queue jobs (cleared=${result.cleared})`,
      metadata: {
        operation: 'clear-failed',
        ...result,
      },
      req,
    });

    return result;
  }

  async getSystemLogs(query: SystemLogsQueryDto) {
    const limit = query.limit ?? 100;
    const levels = query.level
      ? [query.level]
      : [SystemLogLevel.ERROR, SystemLogLevel.WARN];
    const startDate = query.startDate ? new Date(query.startDate) : null;
    const logsDir = join(process.cwd(), 'logs');

    let files: string[] = [];
    try {
      files = await fs.readdir(logsDir);
    } catch {
      return {
        logs: [],
        total: 0,
        appliedFilters: {
          level: query.level ?? 'error|warn',
          startDate: query.startDate ?? null,
        },
      };
    }

    const candidateFiles = files
      .filter((file) => /^(combined|error)-.*\.log$/.test(file))
      .map((file) => join(logsDir, file));

    const stats = await Promise.all(
      candidateFiles.map(async (filePath) => ({
        filePath,
        stat: await fs.stat(filePath),
      })),
    );
    const orderedFiles = stats
      .sort((a, b) => b.stat.mtimeMs - a.stat.mtimeMs)
      .slice(0, 6)
      .map((entry) => entry.filePath);

    const output: any[] = [];
    for (const filePath of orderedFiles) {
      const content = await fs.readFile(filePath, 'utf8');
      const lines = content.split('\n').filter(Boolean).reverse();
      for (const line of lines) {
        try {
          const parsed = JSON.parse(line);
          const level = `${parsed.level || ''}`.toLowerCase();
          const timestamp = parsed.timestamp
            ? new Date(parsed.timestamp)
            : null;

          if (!levels.includes(level as SystemLogLevel)) {
            continue;
          }
          if (startDate && timestamp && timestamp < startDate) {
            continue;
          }

          output.push({
            timestamp: parsed.timestamp || null,
            level,
            message:
              typeof parsed.message === 'string'
                ? parsed.message
                : JSON.stringify(parsed.message),
            context: parsed.context || null,
            stack: parsed.stack || null,
          });

          if (output.length >= limit) {
            return {
              logs: output,
              total: output.length,
              appliedFilters: {
                level: query.level ?? 'error|warn',
                startDate: query.startDate ?? null,
              },
            };
          }
        } catch {
          continue;
        }
      }
    }

    return {
      logs: output,
      total: output.length,
      appliedFilters: {
        level: query.level ?? 'error|warn',
        startDate: query.startDate ?? null,
      },
    };
  }

  deriveOverallStatus(input: {
    databaseStatus: ServiceHealthStatus;
    redisStatus: ServiceHealthStatus;
    queueFailedCounts: number[];
    chainStatuses: ServiceHealthStatus[];
    memory: {
      heapUsedMb: number;
      heapTotalMb: number;
      rssMb: number;
    };
  }): OverallHealthStatus {
    const memoryRatio = input.memory.heapTotalMb
      ? input.memory.heapUsedMb / input.memory.heapTotalMb
      : 0;
    const totalFailed = input.queueFailedCounts.reduce(
      (sum, count) => sum + count,
      0,
    );
    const unhealthyChains = input.chainStatuses.filter(
      (status) => status === 'unhealthy',
    ).length;

    if (
      input.databaseStatus === 'unhealthy' ||
      input.redisStatus === 'unhealthy'
    ) {
      return 'critical';
    }

    if (memoryRatio >= 0.9 || totalFailed >= 1000 || unhealthyChains >= 2) {
      return 'critical';
    }

    if (
      input.databaseStatus === 'degraded' ||
      input.redisStatus === 'degraded' ||
      memoryRatio >= 0.8 ||
      totalFailed > 0 ||
      unhealthyChains === 1
    ) {
      return 'degraded';
    }

    return 'healthy';
  }

  private async getDatabaseHealth() {
    const start = Date.now();
    try {
      await this.dataSource.query('SELECT 1');
      const latencyMs = Date.now() - start;

      let activeConnections: number | null = null;
      try {
        const result = await this.dataSource.query(
          'SELECT COUNT(*)::int AS count FROM pg_stat_activity WHERE datname = current_database()',
        );
        activeConnections = result?.[0]?.count ?? null;
      } catch {
        activeConnections = null;
      }

      const status: ServiceHealthStatus =
        latencyMs > 500 ? 'degraded' : 'healthy';
      return {
        status,
        latencyMs,
        activeConnections,
      };
    } catch {
      return {
        status: 'unhealthy' as ServiceHealthStatus,
        latencyMs: null,
        activeConnections: null,
      };
    }
  }

  private async getRedisHealth() {
    const start = Date.now();
    try {
      const pong = await this.redisService.ping();
      const latencyMs = Date.now() - start;
      const info = await this.redisService.info('memory');
      const usedBytes = this.extractRedisMemoryUsed(info);

      const status: ServiceHealthStatus =
        pong === 'PONG'
          ? latencyMs > 150
            ? 'degraded'
            : 'healthy'
          : 'unhealthy';

      return {
        status,
        latencyMs,
        memoryUsedMb: usedBytes ? this.toMb(usedBytes) : null,
      };
    } catch {
      return {
        status: 'unhealthy' as ServiceHealthStatus,
        latencyMs: null,
        memoryUsedMb: null,
      };
    }
  }

  private async getQueueHealth() {
    const stats = await this.queueService.getAllQueueStats();
    const response: Record<
      string,
      {
        waiting: number;
        active: number;
        completed: number;
        failed: number;
        delayed: number;
      }
    > = {};
    for (const queue of stats) {
      response[queue.queueName] = {
        waiting: queue.waiting,
        active: queue.active,
        completed: queue.completed,
        failed: queue.failed,
        delayed: queue.delayed,
      };
    }
    return response;
  }

  private async getChainHealth() {
    const result: Record<
      string,
      {
        status: ServiceHealthStatus;
        latencyMs: number | null;
        latestBlock: number | null;
      }
    > = {};

    await Promise.all(
      this.trackedChains.map(async (chain) => {
        const start = Date.now();
        try {
          const provider = this.chainService.getProvider(chain);
          const latestBlock = await provider.getBlockNumber();
          const latencyMs = Date.now() - start;
          result[chain] = {
            status: latencyMs > 1200 ? 'degraded' : 'healthy',
            latencyMs,
            latestBlock,
          };
        } catch {
          result[chain] = {
            status: 'unhealthy',
            latencyMs: null,
            latestBlock: null,
          };
        }
      }),
    );

    return result;
  }

  private assertValidQueueName(queueName: string) {
    const validNames = this.queueService.getQueueNames();
    if (!validNames.includes(queueName)) {
      throw new NotFoundException(
        `Unknown queue "${queueName}". Supported queues: ${validNames.join(', ')}`,
      );
    }
  }

  private extractRedisMemoryUsed(info: string): number | null {
    const memoryMatch = info.match(/^used_memory:(\d+)$/m);
    if (!memoryMatch) {
      return null;
    }
    return parseInt(memoryMatch[1], 10);
  }

  private toMb(value: number): number {
    return Math.round((value / 1024 / 1024) * 100) / 100;
  }
}
