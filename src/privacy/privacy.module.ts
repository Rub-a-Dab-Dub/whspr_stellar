import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bull';
import { PrivacyService } from './privacy.service';
import { PrivacyController } from './privacy.controller';
import { DataExportProcessor } from './queues/data-export.processor';
import { DataExportRequestRepository } from './data-export-request.repository';
import { ConsentRecordsRepository } from './consent-records.repository';
import { DataExportRequest } from './entities/data-export-request.entity';
import { ConsentRecord } from './entities/consent-record.entity';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([DataExportRequest, ConsentRecord]),
    BullModule.registerQueue({ name: 'data-export' }),
    UsersModule,
  ],
  providers: [PrivacyService, DataExportRequestRepository, ConsentRecordsRepository, DataExportProcessor],
  controllers: [PrivacyController],
  exports: [PrivacyService],
})
export class PrivacyModule {}
