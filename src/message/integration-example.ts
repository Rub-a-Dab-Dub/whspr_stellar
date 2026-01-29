/**
 * Example of how to integrate the new notification system with existing message services
 * 
 * This file shows how to update your ReactionService and MessageService to use
 * the new comprehensive notification system.
 */

import { Injectable } from '@nestjs/common';
import { MessageNotificationService } from '../notifications/services/message-notification.service';

// Example: Update your ReactionService
@Injectable()
export class ReactionServiceExample {
  constructor(
    // ... your existing dependencies
    private readonly messageNotificationService: MessageNotificationService,
  ) {}

  async addReaction(messageId: string, userId: string, reaction: string) {
    // ... your existing reaction logic

    // Get the message to find the author and room
    const message = await this.getMessageById(messageId);
    
    // Replace old notification call with new system
    await this.messageNotificationService.handleMessageReaction(
      messageId,
      message.authorId,
      userId,
      message.roomId,
      reaction,
      true, // isAdded = true
    );
  }

  async removeReaction(messageId: string, userId: string, reaction: string) {
    // ... your existing reaction removal logic

    const message = await this.getMessageById(messageId);
    
    // The new system can handle reaction removals too (though it doesn't notify by default)
    await this.messageNotificationService.handleMessageReaction(
      messageId,
      message.authorId,
      userId,
      message.roomId,
      reaction,
      false, // isAdded = false
    );
  }

  private async getMessageById(messageId: string) {
    // Your existing logic to get message
    return { authorId: 'author-id', roomId: 'room-id' };
  }
}

// Example: Update your MessageService
@Injectable()
export class MessageServiceExample {
  constructor(
    // ... your existing dependencies
    private readonly messageNotificationService: MessageNotificationService,
  ) {}

  async createMessage(content: string, authorId: string, roomId: string) {
    // ... your existing message creation logic
    const savedMessage = { id: 'message-id', content, authorId, roomId };

    // Get room members (you'll need to implement this based on your room system)
    const roomMemberIds = await this.getRoomMemberIds(roomId);

    // Send notifications for the new message
    await this.messageNotificationService.handleNewMessage(
      savedMessage.id,
      savedMessage.content,
      savedMessage.authorId,
      savedMessage.roomId,
      roomMemberIds,
    );

    return savedMessage;
  }

  async editMessage(messageId: string, newContent: string, authorId: string) {
    // ... your existing message edit logic
    const originalMessage = await this.getMessageById(messageId);
    
    // Update the message
    const updatedMessage = { ...originalMessage, content: newContent };

    // Get room members
    const roomMemberIds = await this.getRoomMemberIds(originalMessage.roomId);

    // Send notifications for significant edits
    await this.messageNotificationService.handleMessageEdit(
      messageId,
      originalMessage.content,
      newContent,
      authorId,
      originalMessage.roomId,
      roomMemberIds,
    );

    return updatedMessage;
  }

  private async getRoomMemberIds(roomId: string): Promise<string[]> {
    // Implement this based on your room/membership system
    // This should return an array of user IDs who are members of the room
    return ['user1', 'user2', 'user3'];
  }

  private async getMessageById(messageId: string) {
    // Your existing logic to get message
    return { id: messageId, content: 'content', authorId: 'author-id', roomId: 'room-id' };
  }
}

/**
 * Migration Steps:
 * 
 * 1. Import MessageNotificationService in your existing services
 * 2. Replace old notification calls with new system calls
 * 3. Implement getRoomMemberIds() method in your services
 * 4. Test the integration
 * 
 * Benefits of the new system:
 * - Real-time WebSocket notifications
 * - Email and push notification support
 * - User preference management
 * - Mute/unmute functionality
 * - Mention detection
 * - Comprehensive notification history
 * - Automatic cleanup
 */