// src/health/health.module.ts
import { Module } from '@nestjs/common';
import { TerminusModule } from '@nestjs/terminus';
import { HttpModule } from '@nestjs/axios';
import { HealthController } from './health.controller';
import { EvmRpcHealthIndicator } from './indicators/evm-rpc.indicator';
import { QueueHealthIndicator } from './indicators/queue.indicator';

@Module({
  imports: [
    TerminusModule.forRoot({
      errorLogStyle: 'pretty',
      gracefulShutdownTimeoutMs: 1000,
    }),
    HttpModule.register({
      timeout: 3000,
      maxRedirects: 3,
    }),
  ],
  controllers: [HealthController],
  providers: [EvmRpcHealthIndicator, QueueHealthIndicator],
})
export class HealthModule {}
