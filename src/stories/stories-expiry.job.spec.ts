import { StoriesExpiryJob } from './stories-expiry.job';
import { StoriesRepository } from './stories.repository';

describe('StoriesExpiryJob', () => {
  it('runs purge and logs when rows removed', async () => {
    const repository = { deleteExpired: jest.fn().mockResolvedValue(3) };
    const job = new StoriesExpiryJob(repository as unknown as StoriesRepository);
    const logSpy = jest.spyOn((job as any).logger, 'log').mockImplementation();

    await job.purgeExpired();

    expect(repository.deleteExpired).toHaveBeenCalled();
    expect(logSpy).toHaveBeenCalled();

    logSpy.mockRestore();
  });

  it('does not log when nothing removed', async () => {
    const repository = { deleteExpired: jest.fn().mockResolvedValue(0) };
    const job = new StoriesExpiryJob(repository as unknown as StoriesRepository);
    const logSpy = jest.spyOn((job as any).logger, 'log').mockImplementation();

    await job.purgeExpired();

    expect(logSpy).not.toHaveBeenCalled();
    logSpy.mockRestore();
  });
});
