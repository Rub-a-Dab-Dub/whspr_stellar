import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { Quest } from './entities/quest.entity';
import { QuestProgress } from './entities/quest-progress.entity';
import { QuestProgressService } from './services/quest-progress.service';
import { QuestCompletionService } from './services/quest-completion.service';
import { QuestRewardService } from './services/quest-reward.service';
import { QuestProgressController } from './controllers/quest-progress.controller';
import { QuestProgressCache } from './cache/quest-progress.cache';

@Module({
  imports: [
    TypeOrmModule.forFeature([Quest, QuestProgress]),
    EventEmitterModule.forRoot(),
  ],
  controllers: [QuestProgressController],
  providers: [
    QuestProgressService,
    QuestCompletionService,
    QuestRewardService,
    QuestProgressCache,
  ],
  exports: [QuestProgressService],
})
export class QuestsModule {}
