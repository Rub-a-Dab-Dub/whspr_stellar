import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bull';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { ReportsService } from './services/reports.service';
import { ReportProcessor } from './processors/report.processor';
import { User } from '../user/entities/user.entity';
import { AuditLog } from './entities/audit-log.entity';
import { ReportJob } from './entities/report-job.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, AuditLog, ReportJob]),
    BullModule.registerQueue({
      name: 'reports',
    }),
  ],
  controllers: [AdminController],
  providers: [AdminService, ReportsService, ReportProcessor],
  exports: [AdminService, ReportsService],
})
export class AdminModule {}
