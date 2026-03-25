import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ModerationQueueItemDto } from './dto/moderation-queue-item.dto';
import { ReportResponseDto } from './dto/report-response.dto';
import { SubmitReportDto } from './dto/submit-report.dto';
import { ModerationActionsService } from './moderation-actions.service';
import { ReportNotificationsService } from './report-notifications.service';
import { ReportsRepository } from './reports.repository';
import { Report, ReportStatus, ReportTargetType } from './entities/report.entity';

@Injectable()
export class ReportsService {
  private readonly logger = new Logger(ReportsService.name);

  constructor(
    private readonly reportsRepository: ReportsRepository,
    private readonly configService: ConfigService,
    private readonly moderationActionsService: ModerationActionsService,
    private readonly reportNotificationsService: ReportNotificationsService,
  ) {}

  async submitReport(reporterId: string, dto: SubmitReportDto): Promise<ReportResponseDto> {
    const cutoff = new Date(Date.now() - this.getCooldownMinutes() * 60_000);
    const duplicate = await this.reportsRepository.existsRecentDuplicate(
      reporterId,
      dto.targetId,
      dto.targetType,
      cutoff,
    );

    if (duplicate) {
      throw new BadRequestException('Duplicate report blocked during cooldown window');
    }

    const report = this.reportsRepository.create({
      reporterId,
      targetId: dto.targetId,
      targetType: dto.targetType,
      reason: dto.reason.trim(),
      description: dto.description?.trim() || null,
      status: ReportStatus.PENDING,
      reviewedBy: null,
      reviewedAt: null,
    });

    const savedReport = await this.reportsRepository.save(report);
    const reportCount = await this.reportsRepository.countByTarget(dto.targetId, dto.targetType);

    await this.applyAutomatedThresholds(savedReport, reportCount);
    const refreshedReport = await this.getReportOrThrow(savedReport.id);

    return this.toResponseDto(refreshedReport);
  }

  async reviewReport(reportId: string, adminId: string): Promise<ReportResponseDto> {
    const report = await this.getReportOrThrow(reportId);

    if (report.status === ReportStatus.ACTIONED) {
      return this.toResponseDto(report);
    }

    const reviewedAt = new Date();
    await this.reportsRepository.updateStatus(
      report.id,
      ReportStatus.REVIEWED,
      adminId,
      reviewedAt,
    );

    return this.toResponseDto({
      ...report,
      status: ReportStatus.REVIEWED,
      reviewedBy: adminId,
      reviewedAt,
    });
  }

  async dismissReport(reportId: string, adminId: string): Promise<ReportResponseDto> {
    const report = await this.getReportOrThrow(reportId);

    if (report.status === ReportStatus.DISMISSED) {
      return this.toResponseDto(report);
    }

    const reviewedAt = new Date();
    await this.reportsRepository.updateStatus(
      report.id,
      ReportStatus.DISMISSED,
      adminId,
      reviewedAt,
    );

    await this.reportNotificationsService.notifyReporterResolution(
      report.reporterId,
      report.id,
      ReportStatus.DISMISSED,
    );

    return this.toResponseDto({
      ...report,
      status: ReportStatus.DISMISSED,
      reviewedBy: adminId,
      reviewedAt,
    });
  }

  async actionReport(reportId: string, adminId: string): Promise<ReportResponseDto> {
    const report = await this.getReportOrThrow(reportId);

    if (report.status !== ReportStatus.ACTIONED) {
      await this.moderationActionsService.executeTargetAction(report.targetType, report.targetId);
    }

    const reviewedAt = new Date();
    await this.reportsRepository.updateStatus(
      report.id,
      ReportStatus.ACTIONED,
      adminId,
      reviewedAt,
    );

    await this.reportNotificationsService.notifyReporterResolution(
      report.reporterId,
      report.id,
      ReportStatus.ACTIONED,
    );

    return this.toResponseDto({
      ...report,
      status: ReportStatus.ACTIONED,
      reviewedBy: adminId,
      reviewedAt,
    });
  }

  async getModerationQueue(): Promise<ModerationQueueItemDto[]> {
    const reports = await this.reportsRepository.getPendingReports();
    const counts = await this.buildTargetCountMap(reports);
    const priorityThreshold = this.getAutoFlagThreshold();

    return reports
      .map((report) => {
        const key = this.targetKey(report.targetType, report.targetId);
        const reportCount = counts.get(key) ?? 1;
        const severity = this.getSeverity(report.reason);

        return {
          id: report.id,
          targetType: report.targetType,
          targetId: report.targetId,
          reason: report.reason,
          description: report.description,
          status: report.status,
          createdAt: report.createdAt,
          reportCount,
          severity,
          isPriority: reportCount >= priorityThreshold,
        };
      })
      .sort((left, right) => {
        if (right.reportCount !== left.reportCount) {
          return right.reportCount - left.reportCount;
        }

        if (right.severity !== left.severity) {
          return right.severity - left.severity;
        }

        return left.createdAt.getTime() - right.createdAt.getTime();
      });
  }

  async getReportsByTarget(
    targetId: string,
    targetType: ReportTargetType,
  ): Promise<ReportResponseDto[]> {
    const reports = await this.reportsRepository.findByTarget(targetId, targetType);
    return reports.map((report) => this.toResponseDto(report));
  }

  private async applyAutomatedThresholds(report: Report, reportCount: number): Promise<void> {
    if (reportCount >= this.getAutoFlagThreshold()) {
      this.logger.warn(
        `Report target marked for priority review: ${report.targetType}:${report.targetId} count=${reportCount}`,
      );
    }

    if (
      report.targetType === ReportTargetType.MESSAGE &&
      reportCount >= this.getAutoDeleteThreshold()
    ) {
      await this.moderationActionsService.executeTargetAction(report.targetType, report.targetId);
      await this.reportsRepository.updateStatusByTarget(
        report.targetId,
        report.targetType,
        [ReportStatus.PENDING, ReportStatus.REVIEWED],
        ReportStatus.ACTIONED,
        new Date(),
      );

      const reports = await this.reportsRepository.findByTarget(report.targetId, report.targetType);
      await Promise.all(
        reports.map((item) =>
          this.reportNotificationsService.notifyReporterResolution(
            item.reporterId,
            item.id,
            ReportStatus.ACTIONED,
          ),
        ),
      );
    }
  }

  private async getReportOrThrow(reportId: string): Promise<Report> {
    const report = await this.reportsRepository.findOneById(reportId);
    if (!report) {
      throw new NotFoundException(`Report ${reportId} not found`);
    }

    return report;
  }

  private async buildTargetCountMap(reports: Report[]): Promise<Map<string, number>> {
    const countMap = new Map<string, number>();

    await Promise.all(
      reports.map(async (report) => {
        const key = this.targetKey(report.targetType, report.targetId);
        if (!countMap.has(key)) {
          const count = await this.reportsRepository.countByTarget(
            report.targetId,
            report.targetType,
          );
          countMap.set(key, count);
        }
      }),
    );

    return countMap;
  }

  private getSeverity(reason: string): number {
    const normalized = reason.toLowerCase();

    if (/(violence|threat|hate|abuse|harassment|exploit)/.test(normalized)) {
      return 3;
    }

    if (/(spam|impersonation|fraud|scam)/.test(normalized)) {
      return 2;
    }

    return 1;
  }

  private getAutoFlagThreshold(): number {
    return this.configService.get<number>('REPORT_AUTO_FLAG_THRESHOLD', 3);
  }

  private getAutoDeleteThreshold(): number {
    return this.configService.get<number>('REPORT_AUTO_DELETE_THRESHOLD', 5);
  }

  private getCooldownMinutes(): number {
    return this.configService.get<number>('REPORT_COOLDOWN_MINUTES', 30);
  }

  private targetKey(targetType: ReportTargetType, targetId: string): string {
    return `${targetType}:${targetId}`;
  }

  private toResponseDto(report: Report): ReportResponseDto {
    return {
      id: report.id,
      targetType: report.targetType,
      targetId: report.targetId,
      reason: report.reason,
      description: report.description,
      status: report.status,
      reviewedBy: report.reviewedBy,
      reviewedAt: report.reviewedAt,
      createdAt: report.createdAt,
    };
  }
}
