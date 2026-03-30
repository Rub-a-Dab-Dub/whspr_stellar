import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bullmq';
import { ConfigModule } from '@nestjs/config';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { HistoryImportJob } from './entities/history-import-job.entity';
import { StellarHistoryImporterService } from './stellar-history-importer.service';
import { StellarHistoryImporterController } from './stellar-history-importer.controller';
import {
  HistoryImportProcessor,
  HISTORY_IMPORT_QUEUE,
} from './processors/history-import.processor';
import { WalletVerifiedListener } from './listeners/wallet-verified.listener';

@Module({
  imports: [
    ConfigModule,
    EventEmitterModule.forRoot(),
    TypeOrmModule.forFeature([HistoryImportJob]),
    BullModule.registerQueue({ name: HISTORY_IMPORT_QUEUE }),
  ],
  controllers: [StellarHistoryImporterController],
  providers: [
    StellarHistoryImporterService,
    HistoryImportProcessor,
    WalletVerifiedListener,
  ],
  exports: [StellarHistoryImporterService],
})
export class StellarHistoryImporterModule {}
