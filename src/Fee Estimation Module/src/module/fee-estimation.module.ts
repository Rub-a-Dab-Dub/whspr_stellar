import { Module } from '@nestjs/common';
import { FeeEstimationService } from '../service/fee-estimation.service';
import { FeeEstimationController } from '../controller/fee-estimation.controller';
import { HorizonClient } from '../transport/horizon.client';
import { RedisCache } from '../util/redis-cache';

@Module({
  providers: [FeeEstimationService, HorizonClient, RedisCache],
  controllers: [FeeEstimationController]
})
export class FeeEstimationModule {}
