import { EventIndexingProcessor } from '../workers/event-indexing.processor';

describe('EventIndexingProcessor', () => {
  let processor: EventIndexingProcessor;

  beforeEach(() => {
    processor = new EventIndexingProcessor();
  });

  it('indexes event and returns indexed true', async () => {
    const mockJob: any = {
      id: '1',
      data: { eventId: 'e1', data: {} },
      updateProgress: jest.fn().mockResolvedValue(undefined),
    };
    const res = await (processor as any).process(mockJob);
    expect(res).toEqual({ indexed: true });
    expect(mockJob.updateProgress).toHaveBeenCalled();
  });
});
