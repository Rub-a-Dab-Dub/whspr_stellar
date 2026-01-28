/**
 * Example of how to integrate the notification system with the message service
 * 
 * This file shows how to modify the existing message service to send notifications
 * when messages are created, edited, or reacted to.
 */

import { Injectable } from '@nestjs/common';
import { MessageNotificationService } from '../services/message-notification.service';

@Injectable()
export class MessageServiceIntegrationExample {
  constructor(
    private readonly messageNotificationService: MessageNotificationService,
  ) {}

  /**
   * Example: Modify the createMessage method in MessageService
   * 
   * Add this code after saving the message in MessageService.createMessage():
   */
  async exampleCreateMessageIntegration(
    savedMessage: any, // The saved message entity
    roomMemberIds: string[], // Array of user IDs who are members of the room
  ) {
    // Send notifications for the new message
    await this.messageNotificationService.handleNewMessage(
      savedMessage.id,
      savedMessage.content,
      savedMessage.authorId,
      savedMessage.roomId,
      roomMemberIds,
    );
  }

  /**
   * Example: Modify the reaction service to send notifications
   * 
   * Add this code when a reaction is added to a message:
   */
  async exampleReactionIntegration(
    messageId: string,
    messageAuthorId: string,
    reactorId: string,
    roomId: string,
    reaction: string,
  ) {
    // Send notification for the reaction
    await this.messageNotificationService.handleMessageReaction(
      messageId,
      messageAuthorId,
      reactorId,
      roomId,
      reaction,
      true, // isAdded = true
    );
  }

  /**
   * Example: Modify the editMessage method in MessageService
   * 
   * Add this code after editing a message:
   */
  async exampleEditMessageIntegration(
    messageId: string,
    originalContent: string,
    newContent: string,
    authorId: string,
    roomId: string,
    roomMemberIds: string[],
  ) {
    // Send notifications for significant edits
    await this.messageNotificationService.handleMessageEdit(
      messageId,
      originalContent,
      newContent,
      authorId,
      roomId,
      roomMemberIds,
    );
  }

  /**
   * Example: Handle reply notifications
   * 
   * Add this code when a message is a reply to another message:
   */
  async exampleReplyIntegration(
    originalMessageId: string,
    originalMessageAuthorId: string,
    replyMessageId: string,
    replyContent: string,
    replyAuthorId: string,
    roomId: string,
  ) {
    // Send notification for the reply
    await this.messageNotificationService.handleMessageReply(
      originalMessageId,
      originalMessageAuthorId,
      replyMessageId,
      replyContent,
      replyAuthorId,
      roomId,
    );
  }
}

/**
 * Integration Steps:
 * 
 * 1. Import MessageNotificationService in your MessageService
 * 2. Inject it in the constructor
 * 3. Call the appropriate notification methods after message operations
 * 4. Make sure to handle errors gracefully (notifications shouldn't break message functionality)
 * 
 * Example MessageService modification:
 * 
 * ```typescript
 * import { MessageNotificationService } from '../notifications/services/message-notification.service';
 * 
 * @Injectable()
 * export class MessageService {
 *   constructor(
 *     // ... existing dependencies
 *     private readonly messageNotificationService: MessageNotificationService,
 *   ) {}
 * 
 *   async createMessage(createMessageDto: CreateMessageDto, userId: string): Promise<MessageResponseDto> {
 *     // ... existing message creation logic
 *     const savedMessage = await this.messageRepository.save(message);
 * 
 *     // Add notification handling
 *     try {
 *       const roomMemberIds = await this.getRoomMemberIds(savedMessage.roomId);
 *       await this.messageNotificationService.handleNewMessage(
 *         savedMessage.id,
 *         savedMessage.content,
 *         savedMessage.authorId,
 *         savedMessage.roomId,
 *         roomMemberIds,
 *       );
 *     } catch (error) {
 *       // Log error but don't fail the message creation
 *       console.error('Failed to send message notifications:', error);
 *     }
 * 
 *     return this.toResponseDto(savedMessage);
 *   }
 * }
 * ```
 */