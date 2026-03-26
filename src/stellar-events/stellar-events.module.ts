import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';
import { ContractEvent } from './contract-event.entity';
import { IndexerCursor } from './indexer-cursor.entity';
import { SorobanRpcService } from './soroban-rpc.service';
import { EventIndexerService } from './event-indexer.service';

@Module({
  imports: [ScheduleModule.forRoot(), TypeOrmModule.forFeature([ContractEvent, IndexerCursor])],
  providers: [SorobanRpcService, EventIndexerService],
  exports: [EventIndexerService],
})
export class StellarEventsModule {}
