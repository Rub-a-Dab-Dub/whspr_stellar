import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { StoriesController } from './stories.controller';
import { StoriesService } from './stories.service';
import { StoriesRepository } from './stories.repository';
import { StoriesGateway } from './stories.gateway';
import { StoriesExpiryJob } from './stories-expiry.job';
import { Story } from './entities/story.entity';
import { StoryView } from './entities/story-view.entity';
import { UsersModule } from '../users/users.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Story, StoryView]),
    forwardRef(() => UsersModule),
    forwardRef(() => AuthModule),
  ],
  controllers: [StoriesController],
  providers: [StoriesService, StoriesRepository, StoriesGateway, StoriesExpiryJob],
  exports: [StoriesService, StoriesGateway],
})
export class StoriesModule {}
