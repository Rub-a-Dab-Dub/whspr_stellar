import { AuditLogRetentionJob } from './audit-log-retention.job';

describe('AuditLogRetentionJob', () => {
  it('archives and purges logs and writes summary', async () => {
    const auditLogService = {
      archiveAndPurge: jest.fn().mockResolvedValue({ archived: 12, purged: 9 }),
    } as any;

    const job = new AuditLogRetentionJob(auditLogService);
    const logSpy = jest
      .spyOn((job as any).logger, 'log')
      .mockImplementation(() => undefined);

    await job.handleRetention();

    expect(auditLogService.archiveAndPurge).toHaveBeenCalled();
    expect(logSpy).toHaveBeenCalledWith(
      expect.stringContaining('Archived: 12, Purged: 9'),
    );
  });
});
