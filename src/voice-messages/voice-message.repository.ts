import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { VoiceMessage } from './entities/voice-message.entity';

@Injectable()
export class VoiceMessageRepository {
  constructor(
    @InjectRepository(VoiceMessage)
    private readonly repo: Repository<VoiceMessage>,
  ) {}

  create(data: Partial<VoiceMessage>): VoiceMessage {
    return this.repo.create(data);
  }

  async save(vm: VoiceMessage): Promise<VoiceMessage> {
    return this.repo.save(vm);
  }

  async findById(id: string): Promise<VoiceMessage | null> {
    return this.repo.findOne({ where: { id } });
  }

  async findByFileKey(fileKey: string): Promise<VoiceMessage | null> {
    return this.repo.findOne({ where: { fileKey } });
  }

  async findByMessageId(messageId: string): Promise<VoiceMessage[]> {
    return this.repo.find({
      where: { messageId, confirmed: true },
      order: { createdAt: 'ASC' },
    });
  }

  async remove(vm: VoiceMessage): Promise<void> {
    await this.repo.remove(vm);
  }
}
