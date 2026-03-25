import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Message } from '../../Conversation Module/src/conversations/entities/message.entity';

@Injectable()
export class AdminContentService {
  constructor(
    @InjectRepository(Message)
    private readonly messageRepository: Repository<Message>,
  ) {}

  async findAllMessages(limit = 100, offset = 0) {
    return this.messageRepository.find({
      order: { createdAt: 'DESC' },
      take: limit,
      skip: offset,
      relations: ['conversation'],
    });
  }

  async deleteMessage(id: string) {
    const message = await this.messageRepository.findOne({ where: { id } });
    if (!message) {
      throw new NotFoundException('Message not found');
    }
    await this.messageRepository.remove(message);
    return { success: true, message: 'Message permanently deleted' };
  }
}
