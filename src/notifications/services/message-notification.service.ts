import { Injectable, Logger } from '@nestjs/common';
import { NotificationService } from './notification.service';
import { MentionDetectionService } from './mention-detection.service';
import { NotificationType } from '../enums/notification-type.enum';

@Injectable()
export class MessageNotificationService {
  private readonly logger = new Logger(MessageNotificationService.name);

  constructor(
    private readonly notificationService: NotificationService,
    private readonly mentionDetectionService: MentionDetectionService,
  ) {}

  /**
   * Handle new message notifications
   */
  async handleNewMessage(
    messageId: string,
    content: string,
    authorId: string,
    roomId: string,
    roomMemberIds: string[],
  ): Promise<void> {
    try {
      // Extract and validate mentions
      const mentions = await this.mentionDetectionService.extractAndValidateMentions(content);
      const mentionedUserIds = this.mentionDetectionService.getMentionedUserIds(mentions);

      // Create notifications for mentioned users
      for (const mentionedUserId of mentionedUserIds) {
        if (mentionedUserId === authorId) continue; // Don't notify the author

        await this.notificationService.createNotification({
          recipientId: mentionedUserId,
          type: NotificationType.MENTION,
          title: 'You were mentioned',
          message: `You were mentioned in a message: ${this.truncateContent(content)}`,
          senderId: authorId,
          roomId,
          messageId,
          data: {
            messageContent: content,
            mentions,
          },
          actionUrl: `/rooms/${roomId}/messages/${messageId}`,
          category: 'message',
          priority: 2, // High priority for mentions
        });
      }

      // Create notifications for other room members (excluding author and mentioned users)
      const otherMemberIds = roomMemberIds.filter(
        memberId => memberId !== authorId && !mentionedUserIds.includes(memberId)
      );

      for (const memberId of otherMemberIds) {
        await this.notificationService.createNotification({
          recipientId: memberId,
          type: NotificationType.MESSAGE,
          title: 'New message',
          message: `New message: ${this.truncateContent(content)}`,
          senderId: authorId,
          roomId,
          messageId,
          data: {
            messageContent: content,
          },
          actionUrl: `/rooms/${roomId}/messages/${messageId}`,
          category: 'message',
          priority: 3, // Normal priority for regular messages
        });
      }

      this.logger.log(`Created notifications for message ${messageId}: ${mentionedUserIds.length} mentions, ${otherMemberIds.length} regular`);
    } catch (error) {
      this.logger.error(`Failed to create message notifications: ${error.message}`);
    }
  }

  /**
   * Handle message reaction notifications
   */
  async handleMessageReaction(
    messageId: string,
    messageAuthorId: string,
    reactorId: string,
    roomId: string,
    reaction: string,
    isAdded: boolean,
  ): Promise<void> {
    try {
      if (messageAuthorId === reactorId) return; // Don't notify self-reactions

      if (isAdded) {
        await this.notificationService.createNotification({
          recipientId: messageAuthorId,
          type: NotificationType.REACTION,
          title: 'Someone reacted to your message',
          message: `Someone reacted with ${reaction} to your message`,
          senderId: reactorId,
          roomId,
          messageId,
          data: {
            reaction,
            isAdded: true,
          },
          actionUrl: `/rooms/${roomId}/messages/${messageId}`,
          category: 'reaction',
          priority: 4, // Lower priority for reactions
        });

        this.logger.log(`Created reaction notification for message ${messageId}: ${reaction}`);
      }
      // Note: We don't create notifications for reaction removals to avoid spam
    } catch (error) {
      this.logger.error(`Failed to create reaction notification: ${error.message}`);
    }
  }

  /**
   * Handle message reply notifications
   */
  async handleMessageReply(
    originalMessageId: string,
    originalMessageAuthorId: string,
    replyMessageId: string,
    replyContent: string,
    replyAuthorId: string,
    roomId: string,
  ): Promise<void> {
    try {
      if (originalMessageAuthorId === replyAuthorId) return; // Don't notify self-replies

      await this.notificationService.createNotification({
        recipientId: originalMessageAuthorId,
        type: NotificationType.REPLY,
        title: 'Someone replied to your message',
        message: `Reply: ${this.truncateContent(replyContent)}`,
        senderId: replyAuthorId,
        roomId,
        messageId: replyMessageId,
        data: {
          originalMessageId,
          replyContent,
        },
        actionUrl: `/rooms/${roomId}/messages/${replyMessageId}`,
        category: 'reply',
        priority: 2, // High priority for replies
      });

      this.logger.log(`Created reply notification for message ${originalMessageId}`);
    } catch (error) {
      this.logger.error(`Failed to create reply notification: ${error.message}`);
    }
  }

  /**
   * Handle message edit notifications (optional - for transparency)
   */
  async handleMessageEdit(
    messageId: string,
    originalContent: string,
    newContent: string,
    authorId: string,
    roomId: string,
    roomMemberIds: string[],
  ): Promise<void> {
    try {
      // Only notify if the edit significantly changes the content
      if (this.isSignificantEdit(originalContent, newContent)) {
        // Check if there were mentions in the original vs new content
        const originalMentions = await this.mentionDetectionService.extractAndValidateMentions(originalContent);
        const newMentions = await this.mentionDetectionService.extractAndValidateMentions(newContent);
        
        const originalMentionIds = this.mentionDetectionService.getMentionedUserIds(originalMentions);
        const newMentionIds = this.mentionDetectionService.getMentionedUserIds(newMentions);
        
        // Notify newly mentioned users
        const newlyMentioned = newMentionIds.filter(id => !originalMentionIds.includes(id));
        
        for (const mentionedUserId of newlyMentioned) {
          if (mentionedUserId === authorId) continue;

          await this.notificationService.createNotification({
            recipientId: mentionedUserId,
            type: NotificationType.MENTION,
            title: 'You were mentioned in an edited message',
            message: `You were mentioned in an edited message: ${this.truncateContent(newContent)}`,
            senderId: authorId,
            roomId,
            messageId,
            data: {
              messageContent: newContent,
              isEdit: true,
              originalContent,
            },
            actionUrl: `/rooms/${roomId}/messages/${messageId}`,
            category: 'message',
            priority: 2,
          });
        }

        this.logger.log(`Created edit notifications for message ${messageId}: ${newlyMentioned.length} new mentions`);
      }
    } catch (error) {
      this.logger.error(`Failed to create edit notifications: ${error.message}`);
    }
  }

  /**
   * Truncate content for notification display
   */
  private truncateContent(content: string, maxLength: number = 100): string {
    if (content.length <= maxLength) {
      return content;
    }
    return content.substring(0, maxLength) + '...';
  }

  /**
   * Check if an edit is significant enough to warrant notifications
   */
  private isSignificantEdit(originalContent: string, newContent: string): boolean {
    // Consider an edit significant if:
    // 1. Content length changed by more than 20%
    // 2. New mentions were added
    // 3. Content is substantially different (simple heuristic)
    
    const lengthDiff = Math.abs(originalContent.length - newContent.length);
    const lengthChangePercent = lengthDiff / originalContent.length;
    
    if (lengthChangePercent > 0.2) {
      return true;
    }

    // Check for new mentions
    const originalMentionCount = this.mentionDetectionService.getMentionCount(originalContent);
    const newMentionCount = this.mentionDetectionService.getMentionCount(newContent);
    
    if (newMentionCount > originalMentionCount) {
      return true;
    }

    // Simple similarity check (could be improved with more sophisticated algorithms)
    const similarity = this.calculateSimilarity(originalContent, newContent);
    return similarity < 0.8; // Less than 80% similar
  }

  /**
   * Calculate simple similarity between two strings
   */
  private calculateSimilarity(str1: string, str2: string): number {
    const longer = str1.length > str2.length ? str1 : str2;
    const shorter = str1.length > str2.length ? str2 : str1;
    
    if (longer.length === 0) {
      return 1.0;
    }
    
    const editDistance = this.levenshteinDistance(longer, shorter);
    return (longer.length - editDistance) / longer.length;
  }

  /**
   * Calculate Levenshtein distance between two strings
   */
  private levenshteinDistance(str1: string, str2: string): number {
    const matrix = [];

    for (let i = 0; i <= str2.length; i++) {
      matrix[i] = [i];
    }

    for (let j = 0; j <= str1.length; j++) {
      matrix[0][j] = j;
    }

    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= str1.length; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          );
        }
      }
    }

    return matrix[str2.length][str1.length];
  }
}