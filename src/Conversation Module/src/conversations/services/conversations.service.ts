import { Injectable, NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In, LessThan, MoreThan, And } from 'typeorm';
import { Conversation, ConversationType } from '../entities/conversation.entity';
import { ConversationParticipant } from '../entities/conversation-participant.entity';
import { Message } from '../entities/message.entity';
import { CreateConversationDto } from '../dto/create-conversation.dto';
import { ConversationResponseDto } from '../dto/conversation-response.dto';

@Injectable()
export class ConversationsService {
  constructor(
    @InjectRepository(Conversation)
    private readonly conversationRepo: Repository<Conversation>,
    @InjectRepository(ConversationParticipant)
    private readonly participantRepo: Repository<ConversationParticipant>,
    @InjectRepository(Message)
    private readonly messageRepo: Repository<Message>,
  ) {}

  async createDirect(dto: CreateConversationDto, currentUserId: string): Promise<Conversation> {
    if (dto.type !== ConversationType.DIRECT) {
      throw new BadRequestException('Invalid conversation type for direct chat');
    }
    if (dto.participants.length !== 2) {
      throw new BadRequestException('Direct conversation must have exactly 2 participants');
    }

    const participants = dto.participants;
    if (!participants.includes(currentUserId)) {
      throw new BadRequestException('Current user must be one of the participants');
    }

    // Check for duplicate
    const existing = await this.conversationRepo
      .createQueryBuilder('c')
      .innerJoin('c.participants', 'p1', 'p1.userId = :u1', { u1: participants[0] })
      .innerJoin('c.participants', 'p2', 'p2.userId = :u2', { u2: participants[1] })
      .where('c.type = :type', { type: ConversationType.DIRECT })
      .getOne();

    if (existing) {
      return existing;
    }

    const conversation = this.conversationRepo.create({
      type: ConversationType.DIRECT,
      createdBy: currentUserId,
    });

    const saved = await this.conversationRepo.save(conversation);

    const participantEntities = participants.map((userId) =>
      this.participantRepo.create({
        conversationId: saved.id,
        userId,
      }),
    );

    await this.participantRepo.save(participantEntities);

    return this.getConversation(saved.id, currentUserId);
  }

  async createGroup(dto: CreateConversationDto, currentUserId: string): Promise<Conversation> {
    if (dto.type !== ConversationType.GROUP) {
      throw new BadRequestException('Invalid conversation type for group chat');
    }
    if (!dto.groupId) {
      throw new BadRequestException('groupId is required for group chat');
    }

    const participants = dto.participants;
    if (!participants.includes(currentUserId)) {
      participants.push(currentUserId);
    }

    const conversation = this.conversationRepo.create({
      type: ConversationType.GROUP,
      groupId: dto.groupId,
      createdBy: currentUserId,
    });

    const saved = await this.conversationRepo.save(conversation);

    const participantEntities = participants.map((userId) =>
      this.participantRepo.create({
        conversationId: saved.id,
        userId,
      }),
    );

    await this.participantRepo.save(participantEntities);

    return this.getConversation(saved.id, currentUserId);
  }

  async getConversations(
    userId: string,
    limit: number = 20,
    cursor?: string,
    includeArchived: boolean = false,
  ): Promise<{ data: ConversationResponseDto[]; nextCursor?: string }> {
    const query = this.conversationRepo
      .createQueryBuilder('c')
      .innerJoinAndSelect('c.participants', 'p')
      .where((qb) => {
        const subQuery = qb
          .subQuery()
          .select('participant.conversationId')
          .from(ConversationParticipant, 'participant')
          .where('participant.userId = :userId', { userId })
          .getQuery();
        return 'c.id IN ' + subQuery;
      })
      .orderBy('c.lastMessageAt', 'DESC')
      .addOrderBy('c.createdAt', 'DESC')
      .limit(limit + 1);

    if (!includeArchived) {
      query.andWhere('c.isArchived = :isArchived', { isArchived: false });
    }

    if (cursor) {
      // For simplicity, using id as cursor for now. 
      // In a real app, it might be (lastMessageAt, id) for better UX.
      query.andWhere('c.id > :cursor', { cursor });
    }

    const conversations = await query.getMany();

    const hasNext = conversations.length > limit;
    const paginated = hasNext ? conversations.slice(0, limit) : conversations;

    const results = await Promise.all(
      paginated.map(async (c) => {
        const unreadCount = await this.calculateUnreadCount(c.id, userId);
        return this.mapToResponse(c, userId, unreadCount);
      }),
    );

    return {
      data: results,
      nextCursor: hasNext ? paginated[paginated.length - 1].id : undefined,
    };
  }

  async getConversation(id: string, userId: string): Promise<any> {
    const conversation = await this.conversationRepo.findOne({
      where: { id },
      relations: ['participants'],
    });

    if (!conversation) {
      throw new NotFoundException('Conversation not found');
    }

    const isMember = conversation.participants.some((p) => p.userId === userId);
    if (!isMember) {
      throw new BadRequestException('User is not a member of this conversation');
    }

    const unreadCount = await this.calculateUnreadCount(id, userId);
    return this.mapToResponse(conversation, userId, unreadCount);
  }

  async archiveConversation(id: string, userId: string, isArchived: boolean): Promise<void> {
    const conversation = await this.conversationRepo.findOne({
      where: { id },
      relations: ['participants'],
    });

    if (!conversation) {
      throw new NotFoundException('Conversation not found');
    }

    const isMember = conversation.participants.some((p) => p.userId === userId);
    if (!isMember) {
      throw new BadRequestException('User is not a member of this conversation');
    }

    conversation.isArchived = isArchived;
    await this.conversationRepo.save(conversation);
  }

  async markRead(id: string, userId: string): Promise<void> {
    const participant = await this.participantRepo.findOne({
      where: { conversationId: id, userId },
    });

    if (!participant) {
      throw new NotFoundException('Participant not found');
    }

    participant.lastReadAt = new Date();
    await this.participantRepo.save(participant);
  }

  async muteConversation(id: string, userId: string, isMuted: boolean): Promise<void> {
    const participant = await this.participantRepo.findOne({
      where: { conversationId: id, userId },
    });

    if (!participant) {
      throw new NotFoundException('Participant not found');
    }

    participant.isMuted = isMuted;
    await this.participantRepo.save(participant);
  }

  private async calculateUnreadCount(conversationId: string, userId: string): Promise<number> {
    const participant = await this.participantRepo.findOne({
      where: { conversationId, userId },
    });

    if (!participant) return 0;

    const query = this.messageRepo
      .createQueryBuilder('m')
      .where('m.conversationId = :conversationId', { conversationId })
      .andWhere('m.senderId != :userId', { userId });

    if (participant.lastReadAt) {
      query.andWhere('m.createdAt > :lastReadAt', { lastReadAt: participant.lastReadAt });
    }

    return query.getCount();
  }

  private mapToResponse(c: Conversation, userId: string, unreadCount: number): ConversationResponseDto {
    return {
      id: c.id,
      type: c.type,
      groupId: c.groupId,
      createdBy: c.createdBy,
      lastMessageAt: c.lastMessageAt,
      isArchived: c.isArchived,
      createdAt: c.createdAt,
      participants: c.participants.map((p) => ({
        userId: p.userId,
        joinedAt: p.joinedAt,
        lastReadAt: p.lastReadAt,
        isMuted: p.isMuted,
      })),
      unreadCount,
    };
  }

  // Helper for tests to send messages
  async sendMessage(conversationId: string, senderId: string, content: string): Promise<Message> {
    const message = this.messageRepo.create({
      conversationId,
      senderId,
      content,
    });
    const saved = await this.messageRepo.save(message);

    await this.conversationRepo.update(conversationId, {
      lastMessageAt: saved.createdAt,
    });

    return saved;
  }
}
