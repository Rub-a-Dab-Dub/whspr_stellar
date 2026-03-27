import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { QueryFailedError, Repository } from 'typeorm';
import { ChatGateway } from '../messaging/gateways/chat.gateway';
import { Conversation, ConversationType } from '../conversations/entities/conversation.entity';
import { ConversationParticipant } from '../conversations/entities/conversation-participant.entity';
import { Message } from '../messages/entities/message.entity';
import { UsersRepository } from '../users/users.repository';
import { GroupContractService } from '../soroban/services/group-contract/group-contract.service';
import { PinnedMessagesRepository } from './pinned-messages.repository';
import { PinnedMessage } from './entities/pinned-message.entity';
import { PinMessageDto } from './dto/pin-message.dto';
import { ReorderPinnedDto } from './dto/reorder-pinned.dto';
import { PinnedMessageResponseDto } from './dto/pinned-message-response.dto';
import { PIN_LIMIT_DIRECT, PIN_LIMIT_GROUP } from './constants';
import { isGroupAdminOrModerator } from './group-role.util';

@Injectable()
export class PinnedMessagesService {
  private readonly logger = new Logger(PinnedMessagesService.name);

  constructor(
    private readonly pinnedMessagesRepository: PinnedMessagesRepository,
    @InjectRepository(Conversation)
    private readonly conversationRepository: Repository<Conversation>,
    @InjectRepository(ConversationParticipant)
    private readonly participantRepository: Repository<ConversationParticipant>,
    @InjectRepository(Message)
    private readonly messageRepository: Repository<Message>,
    private readonly usersRepository: UsersRepository,
    private readonly groupContractService: GroupContractService,
    private readonly chatGateway: ChatGateway,
  ) {}

  async pinMessage(
    conversationId: string,
    userId: string,
    dto: PinMessageDto,
  ): Promise<PinnedMessageResponseDto> {
    const conversation = await this.getConversationOrThrow(conversationId);
    await this.assertParticipant(conversationId, userId);
    await this.assertCanModifyPins(conversation, userId);

    const message = await this.messageRepository.findOne({
      where: { id: dto.messageId, conversationId },
    });
    if (!message) {
      throw new NotFoundException('Message not found in this conversation');
    }

    const limit =
      conversation.type === ConversationType.GROUP ? PIN_LIMIT_GROUP : PIN_LIMIT_DIRECT;
    const count = await this.pinnedMessagesRepository.countByConversation(conversationId);
    if (count >= limit) {
      throw new BadRequestException(`Pin limit reached (${limit} for this conversation)`);
    }

    const displayOrder = await this.pinnedMessagesRepository.nextDisplayOrder(conversationId);
    const pin = this.pinnedMessagesRepository.create({
      conversationId,
      messageId: message.id,
      pinnedBy: userId,
      note: dto.note ?? null,
      displayOrder,
      snapshotContent: message.content,
      snapshotType: message.type,
      snapshotSenderId: message.senderId,
      snapshotCreatedAt: message.createdAt,
    });

    let saved: PinnedMessage;
    try {
      saved = await this.pinnedMessagesRepository.save(pin);
    } catch (err) {
      if (this.isUniqueViolation(err)) {
        throw new ConflictException('Message is already pinned');
      }
      throw err;
    }

    const response = this.toResponseDto(saved);
    this.chatGateway.emitMessagePinned(conversationId, this.toWsPinnedPayload(response));
    return response;
  }

  async unpinMessage(conversationId: string, messageId: string, userId: string): Promise<void> {
    const conversation = await this.getConversationOrThrow(conversationId);
    await this.assertParticipant(conversationId, userId);
    await this.assertCanModifyPins(conversation, userId);

    const pin = await this.pinnedMessagesRepository.findByConversationAndMessage(
      conversationId,
      messageId,
    );
    if (!pin) {
      throw new NotFoundException('Pin not found');
    }

    await this.pinnedMessagesRepository.remove(pin);
    this.chatGateway.emitMessageUnpinned(conversationId, {
      conversationId,
      messageId,
      unpinnedBy: userId,
      timestamp: Date.now(),
    });
  }

  async getPinnedMessages(conversationId: string, userId: string): Promise<PinnedMessageResponseDto[]> {
    await this.getConversationOrThrow(conversationId);
    await this.assertParticipant(conversationId, userId);

    const pins = await this.pinnedMessagesRepository.findOrderedByConversation(conversationId);
    return pins.map((p) => this.toResponseDto(p));
  }

  async getPinnedCount(conversationId: string): Promise<number> {
    return this.pinnedMessagesRepository.countByConversation(conversationId);
  }

  async reorderPinned(
    conversationId: string,
    userId: string,
    dto: ReorderPinnedDto,
  ): Promise<PinnedMessageResponseDto[]> {
    const conversation = await this.getConversationOrThrow(conversationId);
    await this.assertParticipant(conversationId, userId);
    await this.assertCanModifyPins(conversation, userId);

    const pins = await this.pinnedMessagesRepository.findOrderedByConversation(conversationId);
    const byMessageId = new Map(pins.map((p) => [p.messageId, p]));
    const head: PinnedMessage[] = [];
    for (const mid of dto.messageIds) {
      const pin = byMessageId.get(mid);
      if (!pin) {
        throw new BadRequestException(`Message ${mid} is not pinned in this conversation`);
      }
      head.push(pin);
    }
    const headSet = new Set(dto.messageIds);
    const tail = pins.filter((p) => !headSet.has(p.messageId));
    const ordered = [...head, ...tail];
    ordered.forEach((p, i) => {
      p.displayOrder = i;
    });
    await this.pinnedMessagesRepository.saveAll(ordered);
    return ordered.map((p) => this.toResponseDto(p));
  }

  private async getConversationOrThrow(conversationId: string): Promise<Conversation> {
    const conversation = await this.conversationRepository.findOne({
      where: { id: conversationId },
    });
    if (!conversation) {
      throw new NotFoundException('Conversation not found');
    }
    return conversation;
  }

  private async assertParticipant(conversationId: string, userId: string): Promise<void> {
    const ok = await this.participantRepository.exist({
      where: { conversationId, userId },
    });
    if (!ok) {
      throw new ForbiddenException('Not a participant in this conversation');
    }
  }

  private async assertCanModifyPins(conversation: Conversation, userId: string): Promise<void> {
    if (conversation.type === ConversationType.DIRECT) {
      return;
    }

    if (!(process.env.GROUP_CONTRACT_ID ?? '').trim()) {
      throw new ServiceUnavailableException('Group contract is not configured');
    }

    if (!conversation.chainGroupId) {
      throw new BadRequestException(
        'Group conversation is missing chainGroupId; cannot verify moderator permissions',
      );
    }

    const user = await this.usersRepository.findOne({
      where: { id: userId },
      select: ['id', 'walletAddress'],
    });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    let memberInfo: unknown;
    try {
      memberInfo = await this.groupContractService.getMemberInfo(
        conversation.chainGroupId,
        user.walletAddress,
      );
    } catch (err) {
      this.logger.warn(
        `group_contract.get_member_info failed: ${(err as Error).message}`,
      );
      throw new ServiceUnavailableException('Unable to verify group role on-chain');
    }

    if (!isGroupAdminOrModerator(memberInfo)) {
      throw new ForbiddenException('Only group admins and moderators can manage pins');
    }
  }

  private toResponseDto(pin: PinnedMessage): PinnedMessageResponseDto {
    return {
      id: pin.id,
      conversationId: pin.conversationId,
      messageId: pin.messageId,
      pinnedBy: pin.pinnedBy,
      pinnedAt: pin.pinnedAt,
      note: pin.note,
      displayOrder: pin.displayOrder,
      snapshot: {
        content: pin.snapshotContent,
        type: pin.snapshotType,
        senderId: pin.snapshotSenderId,
        createdAt: pin.snapshotCreatedAt,
      },
    };
  }

  private toWsPinnedPayload(dto: PinnedMessageResponseDto): Record<string, unknown> {
    return {
      ...dto,
      pinnedAt:
        dto.pinnedAt instanceof Date ? dto.pinnedAt.toISOString() : dto.pinnedAt,
      snapshot: {
        ...dto.snapshot,
        createdAt:
          dto.snapshot.createdAt instanceof Date
            ? dto.snapshot.createdAt.toISOString()
            : dto.snapshot.createdAt,
      },
      timestamp: Date.now(),
    };
  }

  private isUniqueViolation(err: unknown): boolean {
    if (!(err instanceof QueryFailedError)) {
      return false;
    }
    const q = err as QueryFailedError & { code?: string; driverError?: { code?: string } };
    return q.code === '23505' || q.driverError?.code === '23505';
  }
}
