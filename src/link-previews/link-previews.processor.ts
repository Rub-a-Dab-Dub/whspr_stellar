import { Processor, Process, InjectQueue } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { LinkPreviewsService } from './link-previews.service';
import { Logger } from '@nestjs/common';

@Processor('link-previews')
export class LinkPreviewsProcessor {
  private readonly logger = new Logger(LinkPreviewsProcessor.name);

  constructor(private readonly service: LinkPreviewsService) {}

  @Process('fetch-preview')
  async handlePreview(job: Job<{ url: string }>) {
    this.logger.log(`Fetching preview for ${job.data.url}`);
    const preview = await this.service.fetchPreview(job.data.url);
    if (!preview) {
      this.logger.warn(`Failed to fetch preview for ${job.data.url}`);
    }
  }
}
