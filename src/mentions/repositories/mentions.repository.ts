import { Injectable } from '@nestjs/common';
import { DataSource, Repository, In } from 'typeorm';
import { Mention } from '../entities/mention.entity';

@Injectable()
export class MentionsRepository extends Repository<Mention> {
  constructor(dataSource: DataSource) {
    super(Mention, dataSource.createEntityManager());
  }

  async findByMessageId(messageId: string): Promise<Mention[]> {
    return this.find({
      where: { messageId },
      order: { createdAt: 'ASC' },
    });
  }

  async findUnreadMentions(userId: string): Promise<Mention[]> {
    return this.find({
      where: { mentionedUserId: userId, isRead: false },
      order: { createdAt: 'DESC' },
    });
  }

  async getUnreadCount(userId: string): Promise<number> {
    return this.count({
      where: { mentionedUserId: userId, isRead: false },
    });
  }

  async getMentionsInConversation(
    conversationId: string,
    limit: number = 50,
    offset: number = 0,
  ): Promise<[Mention[], number]> {
    return this.findAndCount({
      where: { conversationId },
      order: { createdAt: 'DESC' },
      take: limit,
      skip: offset,
    });
  }

  async getMentionsForUser(
    userId: string,
    limit: number = 50,
    offset: number = 0,
  ): Promise<[Mention[], number]> {
    return this.findAndCount({
      where: { mentionedUserId: userId },
      order: { createdAt: 'DESC' },
      take: limit,
      skip: offset,
    });
  }

  async markMentionAsRead(mentionId: string): Promise<void> {
    await this.update({ id: mentionId }, { isRead: true });
  }

  async markMentionsAsRead(mentionIds: string[]): Promise<void> {
    if (mentionIds.length === 0) return;

    await this.update({ id: In(mentionIds) }, { isRead: true });
  }

  async markAllUserMentionsAsRead(userId: string): Promise<void> {
    await this.update({ mentionedUserId: userId, isRead: false }, { isRead: true });
  }

  async deleteMentionByMessageId(messageId: string): Promise<void> {
    await this.delete({ messageId });
  }

  async checkIfUserMentionedInConversation(
    userId: string,
    conversationId: string,
  ): Promise<boolean> {
    const count = await this.count({
      where: { mentionedUserId: userId, conversationId },
    });

    return count > 0;
  }
}
