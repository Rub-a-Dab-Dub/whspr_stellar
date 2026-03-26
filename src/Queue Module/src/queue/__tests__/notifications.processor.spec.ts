import { NotificationsProcessor } from '../workers/notifications.processor';

describe('NotificationsProcessor', () => {
  let processor: NotificationsProcessor;

  beforeEach(() => {
    processor = new NotificationsProcessor();
  });

  it('processes a notification job', async () => {
    const mockJob: any = {
      id: '1',
      data: { userId: 'u1', message: 'hi' },
      updateProgress: jest.fn().mockResolvedValue(undefined),
    };
    const res = await (processor as any).process(mockJob);
    expect(res).toEqual({ ok: true });
    expect(mockJob.updateProgress).toHaveBeenCalled();
  });
});
