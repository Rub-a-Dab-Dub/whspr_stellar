import { Injectable } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { Message } from '../entities/message.entity';
import { MessageEditHistory } from '../entities/message-edit-history.entity';

@Injectable()
export class MessageRepository extends Repository<Message> {
  constructor(private dataSource: DataSource) {
    super(Message, dataSource.createEntityManager());
  }

  async findByIdWithHistory(messageId: string): Promise<Message | null> {
    return this.findOne({
      where: { id: messageId },
      relations: ['editHistory', 'author'],
      order: { editHistory: { editedAt: 'ASC' } },
    });
  }

  async findConversationMessages(
    conversationId: string,
    skip: number = 0,
    take: number = 50,
  ): Promise<[Message[], number]> {
    return this.findAndCount({
      where: {
        conversationId,
        isDeleted: false,
      },
      relations: ['author', 'editHistory'],
      order: { createdAt: 'ASC' },
      skip,
      take,
    });
  }

  async findDeletedMessages(conversationId: string): Promise<Message[]> {
    return this.find({
      where: {
        conversationId,
        isDeleted: true,
        isHardDeleted: false,
      },
      order: { deletedAt: 'DESC' },
    });
  }

  async softDeleteMessage(messageId: string, userId: string): Promise<Message> {
    await this.update(messageId, {
      isDeleted: true,
      deletedAt: new Date(),
      deletedBy: userId,
    });
    return this.findOneBy({ id: messageId });
  }

  async hardDeleteMessage(messageId: string): Promise<void> {
    await this.delete(messageId);
  }

  async hardDeleteConversationMessages(conversationId: string): Promise<void> {
    await this.delete({ conversationId });
  }

  async findRoomMessages(
    roomId: string,
    skip: number = 0,
    take: number = 50,
  ): Promise<[Message[], number]> {
    return this.findAndCount({
      where: {
        roomId,
        isDeleted: false,
      },
      relations: ['author', 'editHistory', 'reactions'],
      order: { createdAt: 'DESC' },
      skip,
      take,
    });
  }

  async findMessagesByType(
    roomId: string,
    type: string,
  ): Promise<Message[]> {
    return this.find({
      where: {
        roomId,
        type,
        isDeleted: false,
      },
      relations: ['author'],
      order: { createdAt: 'DESC' },
    });
  }
}

@Injectable()
export class MessageEditHistoryRepository extends Repository<MessageEditHistory> {
  constructor(private dataSource: DataSource) {
    super(MessageEditHistory, dataSource.createEntityManager());
  }

  async findMessageEditHistory(
    messageId: string,
  ): Promise<MessageEditHistory[]> {
    return this.find({
      where: { messageId },
      order: { editedAt: 'DESC' },
    });
  }

  async createEditHistory(
    messageId: string,
    previousContent: string,
    newContent: string,
  ): Promise<MessageEditHistory> {
    const history = this.create({
      messageId,
      previousContent,
      newContent,
      editedAt: new Date(),
    });
    return this.save(history);
  }
}
