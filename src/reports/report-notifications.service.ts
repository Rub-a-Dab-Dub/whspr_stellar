import { Injectable, Logger } from '@nestjs/common';
import { ReportStatus } from './entities/report.entity';

@Injectable()
export class ReportNotificationsService {
  private readonly logger = new Logger(ReportNotificationsService.name);

  async notifyReporterResolution(
    reporterId: string,
    reportId: string,
    status: ReportStatus,
  ): Promise<void> {
    this.logger.log(
      `Report resolution notification queued: reporter=${reporterId} report=${reportId} status=${status}`,
    );
  }
}
