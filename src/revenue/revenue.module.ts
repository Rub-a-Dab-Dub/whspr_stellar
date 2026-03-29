import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';
import { CacheModule } from '@nestjs/cache-manager';
import { RevenueController } from './revenue.controller';
import { RevenueService } from './revenue.service';
import { RevenueRepository } from './revenue.repository';
import { RevenueRecord } from './entities/revenue-record.entity';
import { FeeDistribution } from './entities/fee-distribution.entity';
import { SorobanModule } from '../soroban/soroban.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([RevenueRecord, FeeDistribution]),
    ScheduleModule.forRoot(),
    CacheModule.register(),
    SorobanModule,
  ],
  controllers: [RevenueController],
  providers: [RevenueService, RevenueRepository],
  exports: [RevenueService],
})
export class RevenueModule {}

