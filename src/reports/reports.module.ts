import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Report } from './entities/report.entity';
import { AdminReportsGuard } from './guards/admin-reports.guard';
import { ModerationActionsService } from './moderation-actions.service';
import { ReportNotificationsService } from './report-notifications.service';
import { ReportsController } from './reports.controller';
import { ReportsRepository } from './reports.repository';
import { ReportsService } from './reports.service';

@Module({
  imports: [TypeOrmModule.forFeature([Report])],
  controllers: [ReportsController],
  providers: [
    ReportsRepository,
    ReportsService,
    AdminReportsGuard,
    ModerationActionsService,
    ReportNotificationsService,
  ],
  exports: [ReportsRepository, ReportsService],
})
export class ReportsModule {}
