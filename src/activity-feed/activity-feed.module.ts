import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ActivityFeedItem } from './entities/activity-feed-item.entity';
import { ActivityFeedRepository } from './repositories/activity-feed.repository';
import { ActivityFeedService } from './services/activity-feed.service';
import { ActivityFeedController } from './controllers/activity-feed.controller';
import { ActivityFeedGateway } from './gateway/activity-feed.gateway';

@Module({
  imports: [
    TypeOrmModule.forFeature([ActivityFeedItem]),
    EventEmitterModule.forRoot(),
  ],
  controllers: [ActivityFeedController],
  providers: [ActivityFeedService, ActivityFeedRepository, ActivityFeedGateway],
  exports: [ActivityFeedService],
})
export class ActivityFeedModule {}
