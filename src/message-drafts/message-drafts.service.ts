import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ChatGateway } from '../messaging/gateways/chat.gateway';
import { MessageDraft } from './entities/message-draft.entity';
import { SaveDraftDto } from './dto/save-draft.dto';
import { DraftResponseDto } from './dto/draft-response.dto';

@Injectable()
export class MessageDraftsService {
  private readonly logger = new Logger(MessageDraftsService.name);

  constructor(
    @InjectRepository(MessageDraft)
    private readonly draftRepo: Repository<MessageDraft>,
    private readonly chatGateway: ChatGateway,
  ) {}

  async saveDraft(
    userId: string,
    conversationId: string,
    dto: SaveDraftDto,
  ): Promise<DraftResponseDto> {
    await this.draftRepo
      .createQueryBuilder()
      .insert()
      .into(MessageDraft)
      .values({
        userId,
        conversationId,
        content: dto.content,
        attachmentIds: dto.attachmentIds ?? null,
        replyToId: dto.replyToId ?? null,
      })
      .orUpdate(['content', 'attachmentIds', 'replyToId', 'updatedAt'], ['userId', 'conversationId'])
      .execute();

    const draft = await this.draftRepo.findOneOrFail({ where: { userId, conversationId } });

    this.scheduleSyncBroadcast(userId, 'draft:saved', draft);

    return this.toDto(draft);
  }

  async getDraft(userId: string, conversationId: string): Promise<DraftResponseDto> {
    const draft = await this.draftRepo.findOne({ where: { userId, conversationId } });
    if (!draft) throw new NotFoundException('No draft found for this conversation');
    return this.toDto(draft);
  }

  async deleteDraft(userId: string, conversationId: string): Promise<void> {
    const result = await this.draftRepo.delete({ userId, conversationId });
    if (result.affected === 0) return; // idempotent — no error if already gone

    this.scheduleSyncBroadcast(userId, 'draft:deleted', { userId, conversationId });
  }

  async getAllDrafts(userId: string): Promise<DraftResponseDto[]> {
    const drafts = await this.draftRepo.find({ where: { userId } });
    return drafts.map((d) => this.toDto(d));
  }

  /** Called by MessagesService after a message is successfully sent. */
  async deleteDraftOnSend(userId: string, conversationId: string): Promise<void> {
    await this.deleteDraft(userId, conversationId);
  }

  // ─── Sync broadcast (fire-and-forget within 5 s window) ─────────────────────

  private scheduleSyncBroadcast(userId: string, event: string, payload: unknown): void {
    setTimeout(() => {
      try {
        this.chatGateway.server?.to(`user:${userId}`).emit(event, payload);
      } catch (err) {
        this.logger.warn(`Sync broadcast failed for ${event}: ${(err as Error).message}`);
      }
    }, 0);
  }

  private toDto(draft: MessageDraft): DraftResponseDto {
    return {
      id: draft.id,
      userId: draft.userId,
      conversationId: draft.conversationId,
      content: draft.content,
      attachmentIds: draft.attachmentIds,
      replyToId: draft.replyToId,
      updatedAt: draft.updatedAt,
    };
  }
}
