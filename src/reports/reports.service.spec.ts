import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ReportsService } from './reports.service';
import { ReportsRepository } from './reports.repository';
import { ModerationActionsService } from './moderation-actions.service';
import { ReportNotificationsService } from './report-notifications.service';
import { ReportStatus, ReportTargetType } from './entities/report.entity';

describe('ReportsService', () => {
  let service: ReportsService;
  let reportsRepository: jest.Mocked<ReportsRepository>;
  let moderationActionsService: jest.Mocked<ModerationActionsService>;
  let notificationsService: jest.Mocked<ReportNotificationsService>;

  const baseReport = {
    id: '0d70d27e-9634-4af4-9af4-14dcb1ec4190',
    reporterId: '4f10e3d1-2b95-4ee4-90c4-4b9032bcf489',
    targetType: ReportTargetType.MESSAGE,
    targetId: '8cf4efa1-39fa-4da8-a650-e4d6d80d4cbf',
    reason: 'harassment',
    description: 'Repeated abusive content',
    status: ReportStatus.PENDING,
    reviewedBy: null,
    reviewedAt: null,
    createdAt: new Date('2026-03-25T00:00:00.000Z'),
  };

  beforeEach(() => {
    reportsRepository = {
      create: jest.fn().mockImplementation((value) => value),
      save: jest.fn(),
      countByTarget: jest.fn(),
      findByTarget: jest.fn(),
      getPendingReports: jest.fn(),
      updateStatus: jest.fn().mockResolvedValue(undefined),
      updateStatusByTarget: jest.fn().mockResolvedValue(0),
      existsRecentDuplicate: jest.fn(),
      findOneById: jest.fn(),
      findResolvedByTargetSince: jest.fn(),
    } as unknown as jest.Mocked<ReportsRepository>;

    moderationActionsService = {
      executeTargetAction: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<ModerationActionsService>;

    notificationsService = {
      notifyReporterResolution: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<ReportNotificationsService>;

    const configService = {
      get: jest.fn().mockImplementation((key: string, fallback: unknown) => {
        if (key === 'REPORT_AUTO_FLAG_THRESHOLD') {
          return 3;
        }
        if (key === 'REPORT_AUTO_DELETE_THRESHOLD') {
          return 5;
        }
        if (key === 'REPORT_COOLDOWN_MINUTES') {
          return 30;
        }

        return fallback;
      }),
    } as unknown as ConfigService;

    service = new ReportsService(
      reportsRepository,
      configService,
      moderationActionsService,
      notificationsService,
    );
  });

  it('submits a report when cooldown allows it', async () => {
    reportsRepository.existsRecentDuplicate.mockResolvedValue(false);
    reportsRepository.save.mockResolvedValue(baseReport as any);
    reportsRepository.countByTarget.mockResolvedValue(1);
    reportsRepository.findOneById.mockResolvedValue(baseReport as any);

    const result = await service.submitReport(baseReport.reporterId, {
      targetType: baseReport.targetType,
      targetId: baseReport.targetId,
      reason: baseReport.reason,
      description: baseReport.description ?? undefined,
    });

    expect(result).toEqual(
      expect.objectContaining({ id: baseReport.id, status: ReportStatus.PENDING }),
    );
    expect(reportsRepository.existsRecentDuplicate).toHaveBeenCalledTimes(1);
  });

  it('blocks duplicate report submission during cooldown', async () => {
    reportsRepository.existsRecentDuplicate.mockResolvedValue(true);

    await expect(
      service.submitReport(baseReport.reporterId, {
        targetType: baseReport.targetType,
        targetId: baseReport.targetId,
        reason: baseReport.reason,
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('triggers automated deletion at threshold for message reports', async () => {
    const actionedReport = { ...baseReport, status: ReportStatus.ACTIONED };
    reportsRepository.existsRecentDuplicate.mockResolvedValue(false);
    reportsRepository.save.mockResolvedValue(baseReport as any);
    reportsRepository.countByTarget.mockResolvedValue(5);
    reportsRepository.findByTarget.mockResolvedValue([
      baseReport,
      { ...baseReport, id: '27d3d415-62c2-4824-ae80-1e22af8455d1', reporterId: 'reporter-2' },
    ] as any);
    reportsRepository.findOneById.mockResolvedValue(actionedReport as any);

    const result = await service.submitReport(baseReport.reporterId, {
      targetType: ReportTargetType.MESSAGE,
      targetId: baseReport.targetId,
      reason: baseReport.reason,
    });

    expect(moderationActionsService.executeTargetAction).toHaveBeenCalledWith(
      ReportTargetType.MESSAGE,
      baseReport.targetId,
    );
    expect(reportsRepository.updateStatusByTarget).toHaveBeenCalled();
    expect(notificationsService.notifyReporterResolution).toHaveBeenCalledTimes(2);
    expect(result.status).toBe(ReportStatus.ACTIONED);
  });

  it('marks a report as reviewed', async () => {
    reportsRepository.findOneById.mockResolvedValue(baseReport as any);

    const result = await service.reviewReport(baseReport.id, 'admin-1');

    expect(reportsRepository.updateStatus).toHaveBeenCalledWith(
      baseReport.id,
      ReportStatus.REVIEWED,
      'admin-1',
      expect.any(Date),
    );
    expect(result.status).toBe(ReportStatus.REVIEWED);
  });

  it('dismisses a report and notifies the reporter', async () => {
    reportsRepository.findOneById.mockResolvedValue(baseReport as any);

    const result = await service.dismissReport(baseReport.id, 'admin-1');

    expect(result.status).toBe(ReportStatus.DISMISSED);
    expect(notificationsService.notifyReporterResolution).toHaveBeenCalledWith(
      baseReport.reporterId,
      baseReport.id,
      ReportStatus.DISMISSED,
    );
  });

  it('actions a report and triggers the moderation hook', async () => {
    reportsRepository.findOneById.mockResolvedValue(baseReport as any);

    const result = await service.actionReport(baseReport.id, 'admin-1');

    expect(result.status).toBe(ReportStatus.ACTIONED);
    expect(moderationActionsService.executeTargetAction).toHaveBeenCalledWith(
      baseReport.targetType,
      baseReport.targetId,
    );
  });

  it('returns moderation queue sorted by report count then severity', async () => {
    const lowPriority = {
      ...baseReport,
      id: '0a847fcc-1d1e-4ef6-8b22-a0ddbb899de9',
      targetId: '7b6a12db-8db7-4591-88ec-2754d08d8d9d',
      reason: 'spam',
      createdAt: new Date('2026-03-25T00:05:00.000Z'),
    };
    const highPriority = {
      ...baseReport,
      id: '97c30d1b-968e-4ce5-8aea-33ce4f0c5cf6',
      targetId: '0ce699da-9dff-440f-b250-b6873dab4ef3',
      reason: 'violent threat',
      createdAt: new Date('2026-03-25T00:10:00.000Z'),
    };

    reportsRepository.getPendingReports.mockResolvedValue([lowPriority, highPriority] as any);
    reportsRepository.countByTarget.mockImplementation(async (targetId: string) =>
      targetId === highPriority.targetId ? 4 : 2,
    );

    const queue = await service.getModerationQueue();

    expect(queue[0]).toEqual(
      expect.objectContaining({
        id: highPriority.id,
        reportCount: 4,
        severity: 3,
        isPriority: true,
      }),
    );
    expect(queue[1]).toEqual(
      expect.objectContaining({
        id: lowPriority.id,
        reportCount: 2,
        severity: 2,
        isPriority: false,
      }),
    );
  });

  it('returns reports by target', async () => {
    reportsRepository.findByTarget.mockResolvedValue([baseReport] as any);

    const result = await service.getReportsByTarget(baseReport.targetId, baseReport.targetType);

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe(baseReport.id);
  });

  it('throws for missing reports', async () => {
    reportsRepository.findOneById.mockResolvedValue(null);

    await expect(service.reviewReport(baseReport.id, 'admin-1')).rejects.toThrow(NotFoundException);
  });
});
