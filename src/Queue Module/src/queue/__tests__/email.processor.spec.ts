import { EmailProcessor } from '../workers/email.processor';

describe('EmailProcessor', () => {
  let processor: EmailProcessor;

  beforeEach(() => {
    processor = new EmailProcessor();
  });

  it('sends email and returns sent:true', async () => {
    const mockJob: any = {
      id: '1',
      data: { to: 'a@b.com', subject: 'hi', body: 'b' },
      updateProgress: jest.fn().mockResolvedValue(undefined),
    };
    const res = await (processor as any).process(mockJob);
    expect(res).toEqual({ sent: true });
    expect(mockJob.updateProgress).toHaveBeenCalled();
  });
});
