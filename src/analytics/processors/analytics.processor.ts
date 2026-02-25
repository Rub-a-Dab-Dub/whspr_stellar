import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AnalyticsEvent } from '../entities/analytics-event.entity';
import { QUEUE_NAMES } from '../../queues/queues.module';

@Processor(QUEUE_NAMES.ANALYTICS)
export class AnalyticsProcessor extends WorkerHost {
  constructor(
    @InjectRepository(AnalyticsEvent)
    private analyticsRepo: Repository<AnalyticsEvent>,
  ) {
    super();
  }

  async process(job: Job): Promise<void> {
    const { userId, eventType, metadata, ipAddress, userAgent } = job.data;
    await this.analyticsRepo.save({
      userId,
      eventType,
      metadata,
      ipAddress,
      userAgent,
    });
  }
}
