import { Injectable } from '@nestjs/common';
import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { QuestProgress } from '../entities/quest-progress.entity';
import { QuestRewardService } from './quest-reward.service';
import { QuestCompletedEvent } from '../events/quest-completed.event';


@Injectable()
export class QuestCompletionService {
constructor(
@InjectRepository(QuestProgress)
private readonly repo: Repository<QuestProgress>,
private readonly rewardService: QuestRewardService,
private readonly eventBus: EventEmitter2,
) {}


async completeQuest(progress: QuestProgress): Promise<void> {
progress.completed = true;
progress.percentage = 100;


await this.repo.save(progress);
await this.rewardService.distributeRewards(progress.userId, progress.questId);


this.eventBus.emit('quest.completed', new QuestCompletedEvent(progress.userId, progress.questId));
}


async claimReward(userId: string, questId: string) {
const progress = await this.repo.findOneBy({ userId, questId });
if (!progress || !progress.completed) {
throw new Error('Quest not completed');
}
return { success: true };
}
}