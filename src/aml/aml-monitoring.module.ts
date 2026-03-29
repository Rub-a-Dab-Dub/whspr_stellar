import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bull';
import { ConfigModule } from '@nestjs/config';
import { AdminModule } from '../admin/admin.module';
import { TransactionsModule } from '../transactions/transactions.module';
import { MailModule } from '../mail/mail.module';

import { AmlFlag, ComplianceReport } from './entities';
import { AmlFlagsRepository } from './aml-flags.repository';
import { AmlMonitoringService } from './aml-monitoring.service';
import { AmlProcessor } from './aml.processor';
import { AmlMonitoringController } from './aml-monitoring.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([AmlFlag, ComplianceReport]),
    BullModule.registerQueue({
      name: 'aml-analysis',
    }),
    ConfigModule,
    AdminModule,
    TransactionsModule,
    MailModule,
  ],
  controllers: [AmlMonitoringController],
  providers: [
    AmlMonitoringService,
    AmlFlagsRepository,
    AmlProcessor,
  ],
  exports: [AmlMonitoringService],
})
export class AmlMonitoringModule {}

