import { Injectable } from '@nestjs/common';
import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { QuestProgress } from '../entities/quest-progress.entity';
import { QuestAction } from '../enums/quest-action.enum';
import { QuestProgressCache } from '../cache/quest-progress.cache';
import { QuestCompletionService } from './quest-completion.service';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { QuestMilestoneEvent } from '../events/quest-milestone.event';

const ACTION_QUEST_MAP: Record<QuestAction, string[]> = {
  [QuestAction.SWAP_COMPLETED]: ['quest_swap_10'],
  [QuestAction.WALLET_CONNECTED]: ['quest_connect_wallet'],
  [QuestAction.TRADE_EXECUTED]: ['quest_trade_daily'],
};

@Injectable()
export class QuestProgressService {
  constructor(
    @InjectRepository(QuestProgress)
    private readonly repo: Repository<QuestProgress>,
    private readonly cache: QuestProgressCache,
    private readonly completionService: QuestCompletionService,
    private readonly eventBus: EventEmitter2,
  ) {}

  async updateProgress(userId: string, action: QuestAction, increment = 1) {
    const questIds = ACTION_QUEST_MAP[action] || [];

    for (const questId of questIds) {
      const progress = await this.repo.findOneBy({ userId, questId });
      if (!progress || progress.completed) continue;

      progress.progress += increment;
      progress.percentage = Math.min(
        (progress.progress / progress.target) * 100,
        100,
      );

      await this.repo.save(progress);
      await this.cache.set(progress);

      if ([25, 50, 75].includes(Math.floor(progress.percentage))) {
        this.eventBus.emit(
          'quest.milestone',
          new QuestMilestoneEvent(userId, questId, progress.percentage),
        );
      }

      if (progress.progress >= progress.target) {
        await this.completionService.completeQuest(progress);
      }
    }
  }
}
