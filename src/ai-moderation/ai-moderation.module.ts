import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AIModerationController } from './controllers/ai-moderation.controller';
import { ModerationResult } from './entities/moderation-result.entity';
import { ModerationProcessor } from './queue/moderation.processor';
import {
  humanModerationBullQueueFactory,
  moderationBullQueueFactory,
  moderationQueueFactory,
  ModerationQueueService,
} from './queue/moderation.queue';
import { AIModerationService } from './services/ai-moderation.service';

@Module({
  imports: [ConfigModule, TypeOrmModule.forFeature([ModerationResult])],
  controllers: [AIModerationController],
  providers: [
    AIModerationService,
    ModerationQueueService,
    ModerationProcessor,
    moderationQueueFactory,
    moderationBullQueueFactory,
    humanModerationBullQueueFactory,
  ],
  exports: [AIModerationService, ModerationQueueService],
})
export class AIModerationModule {}
