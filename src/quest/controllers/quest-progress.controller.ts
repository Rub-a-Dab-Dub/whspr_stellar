import { Controller, Post, Param, Req } from '@nestjs/common';
import { QuestCompletionService } from '../services/quest-completion.service';


@Controller('quests')
export class QuestProgressController {
constructor(private readonly completionService: QuestCompletionService) {}


@Post(':id/claim')
async claim(@Param('id') questId: string, @Req() req) {
return this.completionService.claimReward(req.user.id, questId);
}
}