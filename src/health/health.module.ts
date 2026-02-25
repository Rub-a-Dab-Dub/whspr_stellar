import { Module } from '@nestjs/common';
import { TerminusModule } from '@nestjs/terminus';
import { ConfigModule } from '@nestjs/config';
import { HealthController } from './health.controller';
import { ChainHealthIndicator } from './chain-health.indicator';
import { RedisModule } from '../redis/redis.module';

@Module({
  imports: [TerminusModule, ConfigModule, RedisModule],
  controllers: [HealthController],
  providers: [ChainHealthIndicator],
})
export class HealthModule {}
