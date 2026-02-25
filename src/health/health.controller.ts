import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import {
  HealthCheck,
  HealthCheckService,
  TypeOrmHealthIndicator,
} from '@nestjs/terminus';
import { ChainHealthIndicator } from './chain-health.indicator';
import { RedisHealthIndicator } from '../redis/redis-health.indicator';
import { Public } from '../auth/decorators/public.decorator';

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly db: TypeOrmHealthIndicator,
    private readonly redis: RedisHealthIndicator,
    private readonly chain: ChainHealthIndicator,
  ) {}

  @Public()
  @Get('live')
  @HealthCheck()
  @ApiOperation({ summary: 'Liveness probe — is the process running?' })
  @ApiResponse({ status: 200, description: 'Process is alive' })
  liveness() {
    // Liveness bypasses DB/Redis checks
    return this.health.check([]);
  }

  @Public()
  @Get('ready')
  @HealthCheck()
  @ApiOperation({ summary: 'Readiness probe — is the app ready to serve traffic?' })
  @ApiResponse({ status: 200, description: 'All dependencies healthy' })
  @ApiResponse({ status: 503, description: 'One or more dependencies unhealthy' })
  readiness() {
    return this.health.check([
      () => this.db.pingCheck('database'),
      () => this.redis.isHealthy('redis'),
      () => this.chain.isHealthy(),
    ]);
  }

  @Public()
  @Get()
  @HealthCheck()
  @ApiOperation({
    summary: 'Health — DB, Redis, and chain connectivity',
    description: 'GET /health: DB + Redis + chain checks (for load balancers and probes)',
  })
  @ApiResponse({ status: 200, description: 'All checks passed' })
  @ApiResponse({ status: 503, description: 'One or more checks failed' })
  healthCheck() {
    return this.health.check([
      () => this.db.pingCheck('database'),
      () => this.redis.isHealthy('redis'),
      () => this.chain.isHealthy(),
    ]);
  }
}
