import { SessionsService } from '../sessions/sessions.service';
import { SessionScheduledJobsOperations } from './session-scheduled-jobs.operations';

describe('SessionScheduledJobsOperations', () => {
  it('delegates expired session cleanup to the sessions service', async () => {
    const sessionsService = {
      cleanupExpired: jest.fn().mockResolvedValue(4),
    } as unknown as jest.Mocked<SessionsService>;

    const service = new SessionScheduledJobsOperations(sessionsService);

    await expect(service.cleanupSessions()).resolves.toEqual({
      processedCount: 4,
      metadata: { job: 'session-cleanup' },
    });
    expect(sessionsService.cleanupExpired).toHaveBeenCalledTimes(1);
  });
});
