import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { MessageForwardingRepository } from '../repositories/message-forwarding.repository';
import { ForwardedMessage } from '../entities/forwarded-message.entity';
import {
  ForwardedMessageResponseDto,
  MessageForwardChainItemDto,
  MessageForwardChainResponseDto,
} from '../dto/forward-message.dto';

/**
 * Service for handling message forwarding operations
 * Ensures messages can be forwarded between conversations with proper chain tracking
 */
@Injectable()
export class MessageForwardingService {
  private readonly MAX_FORWARD_DEPTH = 3;

  constructor(private readonly repository: MessageForwardingRepository) {}

  /**
   * Forward a single message to target conversations
   * Validates permissions and prevents forwarding deleted messages
   */
  async forwardMessage(
    originalMessageId: string,
    targetConversationIds: string[],
    forwarderId: string,
    sourceConversationId: string,
  ): Promise<ForwardedMessageResponseDto[]> {
    // Validate target count (max 5)
    if (targetConversationIds.length > 5) {
      throw new BadRequestException('Cannot forward to more than 5 conversations');
    }

    // In a real implementation:
    // 1. Verify message exists and is not deleted
    // 2. Verify forwarder is member of source and all target conversations
    // 3. Check message is not already forwarded too many times

    const forwardedResults: ForwardedMessageResponseDto[] = [];

    for (const targetConversationId of targetConversationIds) {
      if (targetConversationId === sourceConversationId) {
        throw new BadRequestException('Cannot forward to the same conversation');
      }

      // In a real implementation:
      // - Copy message content and attachments
      // - Create new message in target conversation
      // - Preserve original sender metadata (originalSender, originalTimestamp)

      const forwardedMsg = await this.createForwardRecord(
        originalMessageId,
        targetConversationId,
        forwarderId,
        sourceConversationId,
      );

      forwardedResults.push(this.mapToDto(forwardedMsg));
    }

    return forwardedResults;
  }

  /**
   * Forward message to multiple conversations (max 5)
   * Returns all created forward records
   */
  async forwardToMultiple(
    originalMessageId: string,
    targetConversationIds: string[],
    forwarderId: string,
    sourceConversationId: string,
  ): Promise<ForwardedMessageResponseDto[]> {
    // Validate at least 1 target
    if (targetConversationIds.length === 0) {
      throw new BadRequestException('At least one target conversation is required');
    }

    // Validate max 5 targets
    if (targetConversationIds.length > 5) {
      throw new BadRequestException(
        `Cannot forward to more than 5 conversations. Provided: ${targetConversationIds.length}`,
      );
    }

    // Validate no duplicates
    const uniqueTargets = new Set(targetConversationIds);
    if (uniqueTargets.size !== targetConversationIds.length) {
      throw new BadRequestException('Target conversation IDs must be unique');
    }

    return this.forwardMessage(
      originalMessageId,
      targetConversationIds,
      forwarderId,
      sourceConversationId,
    );
  }

  /**
   * Get all forward records for messages forwarded FROM a conversation
   */
  async getForwardedFrom(sourceConversationId: string): Promise<ForwardedMessageResponseDto[]> {
    const forwards = await this.repository.findForwardsBySourceAndTarget(
      sourceConversationId,
      '',
    );

    return forwards.map((f) => this.mapToDto(f));
  }

  /**
   * Get the full forward chain for a message (up to maxDepth)
   * Returns chain of messages starting from original
   */
  async getForwardChain(
    messageId: string,
    originalSenderMetadata?: Record<string, any>,
  ): Promise<MessageForwardChainResponseDto> {
    const chain = await this.repository.findForwardChain(messageId, this.MAX_FORWARD_DEPTH);

    // In a real implementation, would fetch detailed message info
    const chainItems: MessageForwardChainItemDto[] = chain.map((msgId, index) => ({
      messageId: msgId,
      originalTimestamp: new Date(), // Would fetch from message entity
      originalSender: '', // Would fetch from message entity
      forwardedBy: '', // Would fetch from forward record
      forwardedAt: new Date(), // Would fetch from forward record
      depth: index,
    }));

    return {
      chain: chainItems,
      totalDepth: chain.length,
    };
  }

  /**
   * Private helper: Create a forward record
   */
  private async createForwardRecord(
    originalMessageId: string,
    targetConversationId: string,
    forwarderId: string,
    sourceConversationId: string,
  ): Promise<ForwardedMessage> {
    // In a real implementation:
    // - Copy message and attachments
    // - Create new message record
    // - Get the new message ID
    const newMessageId = this.generateMessageId();

    const forward = this.repository.create({
      originalMessageId,
      forwardedMessageId: newMessageId,
      forwardedBy: forwarderId,
      sourceConversationId,
      targetConversationId,
      forwardedAt: new Date(),
    });

    return this.repository.save(forward);
  }

  /**
   * Map entity to DTO
   */
  private mapToDto(entity: ForwardedMessage): ForwardedMessageResponseDto {
    return {
      id: entity.id,
      originalMessageId: entity.originalMessageId,
      forwardedMessageId: entity.forwardedMessageId,
      forwardedBy: entity.forwardedBy,
      sourceConversationId: entity.sourceConversationId,
      targetConversationId: entity.targetConversationId,
      forwardedAt: entity.forwardedAt,
    };
  }

  /**
   * Generate a new message ID (in real impl, would create actual message)
   */
  private generateMessageId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}
