import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../users/entities/user.entity';
import { SorobanModule } from '../soroban/soroban.module';
import { ContractStateCacheEntry } from './entities/contract-state-cache-entry.entity';
import { ContractStateCacheService } from './contract-state-cache.service';
import { ContractStateCacheMetricsService } from './contract-state-cache-metrics.service';
import { ContractStateCacheWarmupService } from './contract-state-cache-warmup.service';
import { ContractStateCacheController } from './contract-state-cache.controller';

@Module({
  imports: [TypeOrmModule.forFeature([ContractStateCacheEntry, User]), SorobanModule],
  controllers: [ContractStateCacheController],
  providers: [
    ContractStateCacheMetricsService,
    ContractStateCacheService,
    ContractStateCacheWarmupService,
  ],
  exports: [ContractStateCacheService],
})
export class ContractStateCacheModule {}
