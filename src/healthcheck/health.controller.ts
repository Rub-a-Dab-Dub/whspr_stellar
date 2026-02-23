// src/health/health.controller.ts
import { Controller, Get } from '@nestjs/common';
import {
  HealthCheck,
  HealthCheckService,
  HttpHealthIndicator,
  TypeOrmHealthIndicator,
  MemoryHealthIndicator,
  DiskHealthIndicator,
  MicroserviceHealthIndicator,
  HealthCheckResult,
} from '@nestjs/terminus';
import { EvmRpcHealthIndicator } from './indicators/evm-rpc.indicator';
import { QueueHealthIndicator } from './indicators/queue.indicator';
import { HealthMetricsDto } from './dto/health-metrics.dto';

@Controller('health')
export class HealthController {
  constructor(
    private health: HealthCheckService,
    private db: TypeOrmHealthIndicator,
    private memory: MemoryHealthIndicator,
    private disk: DiskHealthIndicator,
    private microservice: MicroserviceHealthIndicator,
    private evmRpc: EvmRpcHealthIndicator,
    private queue: QueueHealthIndicator,
  ) {}

  @Get()
  @HealthCheck()
  async check(): Promise<HealthCheckResult> {
    return this.health.check([
      // Database health
      () => this.db.pingCheck('database', { timeout: 1000 }),

      // Redis health (if using @nestjs/microservices)
      () =>
        this.microservice.pingCheck('redis', {
          transport: 'REDIS',
          options: {
            host: process.env.REDIS_HOST || 'localhost',
            port: parseInt(process.env.REDIS_PORT) || 6379,
          },
          timeout: 1000,
        }),

      // Memory heap check (heap shouldn't exceed 300MB)
      () => this.memory.checkHeap('memory_heap', 300 * 1024 * 1024),

      // RSS memory check (shouldn't exceed 500MB)
      () => this.memory.checkRSS('memory_rss', 500 * 1024 * 1024),

      // Disk storage check (should have at least 50% free)
      () =>
        this.disk.checkStorage('disk', {
          path: '/',
          thresholdPercent: 0.5,
        }),

      // EVM RPC health checks
      () => this.evmRpc.checkRpc('ethereum_mainnet', process.env.ETH_RPC_URL),
      () => this.evmRpc.checkRpc('polygon', process.env.POLYGON_RPC_URL),

      // Queue health checks
      () => this.queue.isHealthy('payment_queue'),
      () => this.queue.isHealthy('notification_queue'),
    ]);
  }

  @Get('liveness')
  @HealthCheck()
  async checkLiveness(): Promise<HealthCheckResult> {
    // Lightweight check for Kubernetes liveness probe
    return this.health.check([
      () => this.memory.checkHeap('memory_heap', 400 * 1024 * 1024),
    ]);
  }

  @Get('readiness')
  @HealthCheck()
  async checkReadiness(): Promise<HealthCheckResult> {
    // Check if service is ready to accept traffic
    return this.health.check([
      () => this.db.pingCheck('database', { timeout: 500 }),
      () =>
        this.microservice.pingCheck('redis', {
          transport: 'REDIS',
          options: {
            host: process.env.REDIS_HOST || 'localhost',
            port: parseInt(process.env.REDIS_PORT) || 6379,
          },
          timeout: 500,
        }),
      () => this.evmRpc.checkRpc('primary_rpc', process.env.PRIMARY_RPC_URL),
    ]);
  }

  @Get('metrics')
  async getMetrics(): Promise<HealthMetricsDto> {
    const healthCheck = await this.check();

    return {
      timestamp: new Date().toISOString(),
      status: healthCheck.status,
      uptime: process.uptime(),
      memory: {
        heapUsed: process.memoryUsage().heapUsed,
        heapTotal: process.memoryUsage().heapTotal,
        rss: process.memoryUsage().rss,
        external: process.memoryUsage().external,
      },
      services: healthCheck.info || {},
      errors: healthCheck.error || {},
    };
  }
}
