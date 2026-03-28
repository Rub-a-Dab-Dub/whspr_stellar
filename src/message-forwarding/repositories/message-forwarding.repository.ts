import { Injectable } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { ForwardedMessage } from '../entities/forwarded-message.entity';

@Injectable()
export class MessageForwardingRepository extends Repository<ForwardedMessage> {
  constructor(dataSource: DataSource) {
    super(ForwardedMessage, dataSource.createEntityManager());
  }

  async findForwardById(forwardedMessageId: string): Promise<ForwardedMessage | null> {
    return this.findOne({
      where: { forwardedMessageId },
    });
  }

  async findForwardsByOriginalMessage(originalMessageId: string): Promise<ForwardedMessage[]> {
    return this.find({
      where: { originalMessageId },
      order: { forwardedAt: 'DESC' },
    });
  }

  async findForwardChain(originalMessageId: string, maxDepth: number = 3): Promise<string[]> {
    // Get all messages that are forwards of this message recursively
    const chain: string[] = [originalMessageId];
    const queue: string[] = [originalMessageId];
    let currentDepth = 0;

    while (queue.length > 0 && currentDepth < maxDepth) {
      const current = queue.shift();
      if (!current) continue;

      const forwards = await this.find({
        where: { originalMessageId: current },
        select: ['forwardedMessageId'],
      });

      for (const forward of forwards) {
        if (!chain.includes(forward.forwardedMessageId)) {
          chain.push(forward.forwardedMessageId);
          queue.push(forward.forwardedMessageId);
        }
      }

      currentDepth++;
    }

    return chain;
  }

  async findForwardsBySourceAndTarget(
    sourceConversationId: string,
    targetConversationId: string,
  ): Promise<ForwardedMessage[]> {
    return this.find({
      where: {
        sourceConversationId,
        targetConversationId,
      },
    });
  }

  async countForwardsInConversation(sourceConversationId: string): Promise<number> {
    return this.count({
      where: { sourceConversationId },
    });
  }

  async findForwardsBatch(messageIds: string[]): Promise<ForwardedMessage[]> {
    if (messageIds.length === 0) return [];

    return this.createQueryBuilder('fm')
      .where('fm.forwardedMessageId IN (:...messageIds)', { messageIds })
      .getMany();
  }
}
