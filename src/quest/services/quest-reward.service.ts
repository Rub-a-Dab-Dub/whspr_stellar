import { Injectable } from '@nestjs/common';


@Injectable()
export class QuestRewardService {
async distributeRewards(userId: string, questId: string): Promise<void> {
await this.addXP(userId, questId);
await this.addBadge(userId, questId);
}


private async addXP(userId: string, questId: string) {
// integrate XP service
}


private async addBadge(userId: string, questId: string) {
// integrate Badge service
}
}