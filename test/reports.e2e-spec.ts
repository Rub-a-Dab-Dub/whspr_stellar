import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { APP_GUARD } from '@nestjs/core';
import { CanActivate, ExecutionContext } from '@nestjs/common';
import { ReportsController } from '../src/reports/reports.controller';
import { ReportsService } from '../src/reports/reports.service';
import { ReportStatus, ReportTargetType } from '../src/reports/entities/report.entity';
import { AdminReportsGuard } from '../src/reports/guards/admin-reports.guard';

class TestAuthGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    request.user = {
      id: request.headers?.['x-user-id'] ?? 'user-1',
    };
    return true;
  }
}

describe('ReportsController (e2e)', () => {
  let controller: ReportsController;

  const reportsService = {
    submitReport: jest.fn(),
    getModerationQueue: jest.fn(),
    reviewReport: jest.fn(),
    dismissReport: jest.fn(),
    actionReport: jest.fn(),
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [ReportsController],
      providers: [
        { provide: ReportsService, useValue: reportsService },
        { provide: ConfigService, useValue: { get: jest.fn().mockReturnValue('') } },
        { provide: AdminReportsGuard, useValue: { canActivate: jest.fn().mockReturnValue(true) } },
        { provide: APP_GUARD, useClass: TestAuthGuard },
      ],
    }).compile();

    controller = moduleFixture.get(ReportsController);
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('submits a report without exposing reporter identity', async () => {
    reportsService.submitReport.mockResolvedValue({
      id: 'report-1',
      targetType: ReportTargetType.MESSAGE,
      targetId: '6a8ab9cc-593d-4f58-a864-3a2f7b2c94f8',
      reason: 'harassment',
      description: 'abusive message',
      status: ReportStatus.PENDING,
      reviewedBy: null,
      reviewedAt: null,
      createdAt: new Date(),
    });

    const result = await controller.submitReport('user-1', {
      targetType: ReportTargetType.MESSAGE,
      targetId: '6a8ab9cc-593d-4f58-a864-3a2f7b2c94f8',
      reason: 'harassment',
      description: 'abusive message',
    });

    expect(reportsService.submitReport).toHaveBeenCalledWith(
      'user-1',
      expect.objectContaining({ reason: 'harassment' }),
    );
    expect((result as any).reporterId).toBeUndefined();
  });

  it('returns the moderation queue', async () => {
    reportsService.getModerationQueue.mockResolvedValue([
      {
        id: 'report-1',
        targetType: ReportTargetType.MESSAGE,
        targetId: '6a8ab9cc-593d-4f58-a864-3a2f7b2c94f8',
        reason: 'violent threat',
        description: null,
        status: ReportStatus.PENDING,
        createdAt: new Date(),
        reportCount: 5,
        severity: 3,
        isPriority: true,
      },
    ]);

    const result = await controller.getModerationQueue();

    expect(result[0]).toEqual(
      expect.objectContaining({
        reportCount: 5,
        severity: 3,
        isPriority: true,
      }),
    );
  });

  it('marks a report as reviewed', async () => {
    reportsService.reviewReport.mockResolvedValue({
      id: '1fb5c8cf-db54-4124-ab2e-388926a570fe',
      targetType: ReportTargetType.MESSAGE,
      targetId: '6a8ab9cc-593d-4f58-a864-3a2f7b2c94f8',
      reason: 'spam',
      description: null,
      status: ReportStatus.REVIEWED,
      reviewedBy: 'admin-1',
      reviewedAt: new Date(),
      createdAt: new Date(),
    });

    const result = await controller.reviewReport('1fb5c8cf-db54-4124-ab2e-388926a570fe', 'admin-1');

    expect(reportsService.reviewReport).toHaveBeenCalledWith(
      '1fb5c8cf-db54-4124-ab2e-388926a570fe',
      'admin-1',
    );
    expect(result.status).toBe(ReportStatus.REVIEWED);
  });

  it('actions a report target', async () => {
    reportsService.actionReport.mockResolvedValue({
      id: '1fb5c8cf-db54-4124-ab2e-388926a570fe',
      targetType: ReportTargetType.MESSAGE,
      targetId: '6a8ab9cc-593d-4f58-a864-3a2f7b2c94f8',
      reason: 'spam',
      description: null,
      status: ReportStatus.ACTIONED,
      reviewedBy: 'admin-1',
      reviewedAt: new Date(),
      createdAt: new Date(),
    });

    const result = await controller.actionReport('1fb5c8cf-db54-4124-ab2e-388926a570fe', 'admin-1');

    expect(reportsService.actionReport).toHaveBeenCalledWith(
      '1fb5c8cf-db54-4124-ab2e-388926a570fe',
      'admin-1',
    );
    expect(result.status).toBe(ReportStatus.ACTIONED);
  });
});
