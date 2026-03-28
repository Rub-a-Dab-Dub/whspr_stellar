import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PinnedMessage } from './entities/pinned-message.entity';

@Injectable()
export class PinnedMessagesRepository {
  constructor(
    @InjectRepository(PinnedMessage)
    private readonly repo: Repository<PinnedMessage>,
  ) {}

  create(partial: Partial<PinnedMessage>): PinnedMessage {
    return this.repo.create(partial);
  }

  countByConversation(conversationId: string): Promise<number> {
    return this.repo.count({ where: { conversationId } });
  }

  findOrderedByConversation(conversationId: string): Promise<PinnedMessage[]> {
    return this.repo.find({
      where: { conversationId },
      order: { displayOrder: 'ASC', pinnedAt: 'ASC' },
    });
  }

  findByConversationAndMessage(
    conversationId: string,
    messageId: string,
  ): Promise<PinnedMessage | null> {
    return this.repo.findOne({ where: { conversationId, messageId } });
  }

  async nextDisplayOrder(conversationId: string): Promise<number> {
    const row = await this.repo
      .createQueryBuilder('p')
      .select('MAX(p.displayOrder)', 'max')
      .where('p.conversationId = :conversationId', { conversationId })
      .getRawOne<{ max: string | null }>();
    const max = row?.max != null ? parseInt(row.max, 10) : -1;
    return max + 1;
  }

  save(entity: PinnedMessage): Promise<PinnedMessage> {
    return this.repo.save(entity);
  }

  saveAll(entities: PinnedMessage[]): Promise<PinnedMessage[]> {
    return this.repo.save(entities);
  }

  async remove(entity: PinnedMessage): Promise<void> {
    await this.repo.remove(entity);
  }
}
