import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { StoriesController } from './stories.controller';
import { StoriesService } from './stories.service';
import { StoriesRepository } from './stories.repository';
import { StoriesGateway } from './stories.gateway';
import { Story } from './entities/story.entity';
import { StoryView } from './entities/story-view.entity';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Story, StoryView]),
    forwardRef(() => UsersModule),
  ],
  controllers: [StoriesController],
  providers: [StoriesService, StoriesRepository, StoriesGateway],
  exports: [StoriesService, StoriesGateway],
})
export class StoriesModule {}

