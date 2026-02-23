import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { createHash } from 'crypto';
import { ModerationAuditLog } from '../moderation-audit-log.entity';
import { MessageRepository } from '../../message/repositories/message.repository';
import { MessagesGateway } from '../../message/gateways/messages.gateway';

export interface ModerationResult {
  success: boolean;
  message: {
    id: string;
    roomId: string;
    content: string;
    deletedAt: Date;
    deletedBy: string;
  };
  auditLogId: string;
}

@Injectable()
export class MessageModerationService {
  constructor(
    private readonly messageRepository: MessageRepository,
    @InjectRepository(ModerationAuditLog)
    private readonly moderationAuditLogRepository: Repository<ModerationAuditLog>,
    private readonly messagesGateway: MessagesGateway,
  ) {}

  /**
   * Computes SHA-256 hash of message content
   * @param content - The message content to hash
   * @returns Hex-encoded 64-character hash string
   */
  private computeContentHash(content: string): string {
    return createHash('sha256').update(content).digest('hex');
  }
  /**
   * Creates an audit log entry for a moderation action
   * @param message - The message being moderated
   * @param moderatorId - The ID of the moderator performing the action
   * @param reason - The reason for the moderation action
   * @returns The saved audit log entry
   */
  private async createAuditLog(
    message: any,
    moderatorId: string,
    reason: string,
  ): Promise<ModerationAuditLog> {
    // Compute content hash of original message content
    const contentHash = this.computeContentHash(message.content);

    // Create audit log entity
    const auditLog = this.moderationAuditLogRepository.create({
      roomId: message.roomId,
      messageId: message.id,
      contentHash,
      reason,
      moderatorId,
    });

    // Save and return the audit log
    return await this.moderationAuditLogRepository.save(auditLog);
  }

  /**
   * Broadcasts message deletion event to all room members via WebSocket
   * @param roomId - The ID of the room
   * @param messageId - The ID of the deleted message
   * @param content - The replacement content ("[removed by moderator]")
   * @param deletedAt - The timestamp when the message was deleted
   * @param deletedBy - The ID of the moderator who deleted the message
   */
  private async broadcastDeletion(
    roomId: string,
    messageId: string,
    content: string,
    deletedAt: Date,
    deletedBy: string,
  ): Promise<void> {
    try {
      // Broadcast to all room members
      this.messagesGateway.broadcastToRoom(roomId, 'message-deleted', {
        roomId,
        messageId,
        content,
        deletedAt: deletedAt.toISOString(),
        deletedBy,
      });
    } catch (error) {
      // Log broadcast failures but don't block the deletion
      console.error(
        `Failed to broadcast deletion for message ${messageId} in room ${roomId}:`,
        error,
      );
    }
  }

  /**
   * Deletes a message with soft deletion, audit logging, and WebSocket broadcasting
   * @param roomId - The ID of the room containing the message
   * @param messageId - The ID of the message to delete
   * @param moderatorId - The ID of the moderator performing the deletion
   * @param reason - The reason for the deletion
   * @returns ModerationResult with success status, message data, and audit log ID
   * @throws Error if message not found or doesn't belong to the specified room
   */
  async deleteMessage(
    roomId: string,
    messageId: string,
    moderatorId: string,
    reason: string,
  ): Promise<ModerationResult> {
    // Retrieve message from database
    const message = await this.messageRepository.findOne({
      where: { id: messageId },
    });

    // Verify message exists
    if (!message) {
      throw new Error('Message not found');
    }

    // Verify message belongs to specified room
    if (message.roomId !== roomId) {
      throw new Error('Message does not belong to the specified room');
    }

    // Create audit log entry before modification
    const auditLog = await this.createAuditLog(message, moderatorId, reason);

    // Update message with soft deletion
    message.content = '[removed by moderator]';
    message.deletedAt = new Date();
    message.deletedBy = moderatorId;
    message.isDeleted = true;

    // Save updated message to database
    const updatedMessage = await this.messageRepository.save(message);

    // Broadcast deletion event to all room members
    await this.broadcastDeletion(
      updatedMessage.roomId,
      updatedMessage.id,
      updatedMessage.content,
      updatedMessage.deletedAt!,
      updatedMessage.deletedBy!,
    );

    // Return ModerationResult
    return {
      success: true,
      message: {
        id: updatedMessage.id,
        roomId: updatedMessage.roomId,
        content: updatedMessage.content,
        deletedAt: updatedMessage.deletedAt!,
        deletedBy: updatedMessage.deletedBy!,
      },
      auditLogId: auditLog.id,
    };
  }
}
