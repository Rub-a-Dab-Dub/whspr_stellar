import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MessageService } from './message.service';
import { MessageController } from './message.controller';
import { Message } from './entities/message.entity';
import { MessageEditHistory } from './entities/message-edit-history.entity';
import { MessageReaction } from './entities/message-reaction.entity';
import { MessageOwnershipGuard } from './guards/message-ownership.guard';
import {
  MessageRepository,
  MessageEditHistoryRepository,
} from './repositories/message.repository';
import { ReactionRepository } from './repositories/reaction.repository';
import { ReactionService } from './reaction.service';
import { ReactionController } from './reaction.controller';
import { ReactionNotificationService } from './reaction-notification.service';
import { ReactionAnalyticsService } from './reaction-analytics.service';
import { RedisModule } from '../redis/redis.module';
import { CacheModule } from '../cache/cache.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Message, MessageEditHistory, MessageReaction]),
    RedisModule,
    CacheModule,
  ],
  providers: [
    MessageService,
    MessageOwnershipGuard,
    MessageRepository,
    MessageEditHistoryRepository,
    ReactionRepository,
    ReactionService,
    ReactionNotificationService,
    ReactionAnalyticsService,
  ],
  controllers: [MessageController, ReactionController],
  exports: [
    MessageService,
    MessageRepository,
    MessageEditHistoryRepository,
    ReactionService,
    ReactionRepository,
    ReactionNotificationService,
    ReactionAnalyticsService,
  ],
})
export class MessageModule {}
