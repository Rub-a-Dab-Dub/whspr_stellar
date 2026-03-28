import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ChatGateway } from '../messaging/gateways/chat.gateway';
import { PollsService } from './polls.service';

@Injectable()
export class PollsExpiryJob {
  private readonly logger = new Logger(PollsExpiryJob.name);

  constructor(
    private readonly pollsService: PollsService,
    private readonly chatGateway: ChatGateway,
  ) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async closeExpiredPolls(): Promise<void> {
    const expiredPolls = await this.pollsService.closeExpiredPolls();

    for (const poll of expiredPolls) {
      await this.chatGateway.sendPollUpdated(poll.conversationId, poll);
    }

    if (expiredPolls.length > 0) {
      this.logger.log(`Closed ${expiredPolls.length} expired poll(s).`);
    }
  }
}
