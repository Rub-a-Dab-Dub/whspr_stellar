import { MediaProcessor } from '../workers/media.processor';

describe('MediaProcessor', () => {
  let processor: MediaProcessor;

  beforeEach(() => {
    processor = new MediaProcessor();
  });

  it('processes media and returns outPath', async () => {
    const mockJob: any = {
      id: '1',
      data: { filePath: '/tmp/img.png', transform: 'resize' },
      updateProgress: jest.fn().mockResolvedValue(undefined),
    };
    const res = await (processor as any).process(mockJob);
    expect(res).toEqual({ outPath: '/tmp/img.png.out' });
    expect(mockJob.updateProgress).toHaveBeenCalled();
  });
});
