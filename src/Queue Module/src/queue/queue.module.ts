import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ConfigModule } from '@nestjs/config';
import { QueueService } from './queue.service';
import { NotificationsProcessor } from './workers/notifications.processor';
import { BlockchainProcessor } from './workers/blockchain.processor';
import { MediaProcessor } from './workers/media.processor';
import { EmailProcessor } from './workers/email.processor';
import { EventIndexingProcessor } from './workers/event-indexing.processor';
import { DlqProcessor } from './dlq.processor';

const redisConnection = {
  connection: {
    host: process.env.REDIS_HOST || '127.0.0.1',
    port: Number(process.env.REDIS_PORT) || 6379,
  },
};

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    BullModule.forRoot(redisConnection),
    BullModule.registerQueue(
      { name: 'notifications' },
      { name: 'blockchain-tx' },
      { name: 'media-processing' },
      { name: 'email' },
  { name: 'event-indexing' },
  { name: 'dead-letter' },
    ),
  ],
  providers: [
    QueueService,
    NotificationsProcessor,
    BlockchainProcessor,
    MediaProcessor,
    EmailProcessor,
    EventIndexingProcessor,
  DlqProcessor,
  ],
  exports: [QueueService],
})
export class QueueModule {}
