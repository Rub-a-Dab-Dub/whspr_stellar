import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';
import { ContractEvent } from './contract-event.entity';
import { IndexerCursor } from './indexer-cursor.entity';
import { SorobanRpcService } from './soroban-rpc.service';
import { EventIndexerService } from './event-indexer.service';
import { ContractStateCacheModule } from '../contract-state-cache/contract-state-cache.module';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    TypeOrmModule.forFeature([ContractEvent, IndexerCursor]),
    forwardRef(() => ContractStateCacheModule),
  ],
  providers: [SorobanRpcService, EventIndexerService],
  exports: [EventIndexerService],
})
export class StellarEventsModule {}
