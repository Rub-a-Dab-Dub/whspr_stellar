import { Test } from '@nestjs/testing';
import { LinkPreviewsProcessor } from '../link-previews.processor';
import { LinkPreviewsService } from '../link-previews.service';

describe('LinkPreviewsProcessor', () => {
  it('should process fetch-preview job', async () => {
    const service = { fetchPreview: jest.fn().mockResolvedValue(null) };
    const processor = new LinkPreviewsProcessor(service as any);

    const job = { data: { url: 'https://ex.com' } } as any;

    await processor.handlePreview(job);

    expect(service.fetchPreview).toHaveBeenCalledWith('https://ex.com');
  });
});
