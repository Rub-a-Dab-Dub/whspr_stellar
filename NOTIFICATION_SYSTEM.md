# Notification System Implementation

This document describes the comprehensive notification system implemented for the Whspr Stellar application.

## Overview

The notification system provides real-time and push notifications for messages with user preferences, including:

- ✅ Real-time notifications via WebSocket
- ✅ Push notifications (Firebase)
- ✅ Email notifications
- ✅ User notification preferences
- ✅ Mute/unmute functionality
- ✅ Mention detection (@username)
- ✅ Notification batching
- ✅ Notification cleanup jobs

## Architecture

### Core Components

1. **Entities**
   - `Notification` - Core notification entity
   - `NotificationPreference` - User preferences per type/channel
   - `UserMute` - User mute settings
   - `NotificationBatch` - Batch processing entity

2. **Services**
   - `NotificationService` - Core notification management
   - `NotificationPreferenceService` - User preference management
   - `MuteService` - Mute/unmute functionality
   - `MentionDetectionService` - @username mention detection
   - `PushNotificationService` - Firebase push notifications
   - `EmailNotificationService` - Email notification handling
   - `MessageNotificationService` - Message-specific notifications

3. **Gateways**
   - `NotificationGateway` - WebSocket real-time notifications

4. **Jobs**
   - `NotificationCleanupJob` - Cleanup old notifications
   - `NotificationBatchJob` - Process notification batches

## Notification Types

```typescript
enum NotificationType {
  // Message notifications
  MESSAGE = 'message',
  MENTION = 'mention',
  REPLY = 'reply',
  REACTION = 'reaction',
  
  // Room notifications
  ROOM_INVITATION = 'room_invitation',
  ROOM_JOIN = 'room_join',
  ROOM_LEAVE = 'room_leave',
  ROOM_ROLE_CHANGE = 'room_role_change',
  ROOM_BAN = 'room_ban',
  ROOM_UNBAN = 'room_unban',
  
  // System notifications
  LEVEL_UP = 'level_up',
  ACHIEVEMENT_UNLOCKED = 'achievement_unlocked',
  REWARD_GRANTED = 'reward_granted',
  REWARD_EXPIRED = 'reward_expired',
  REWARD_TRADED = 'reward_traded',
  REWARD_GIFTED = 'reward_gifted',
  
  // Security notifications
  LOGIN_SUCCESS = 'login_success',
  LOGIN_FAILED = 'login_failed',
  PASSWORD_CHANGED = 'password_changed',
  EMAIL_CHANGED = 'email_changed',
  
  // Admin notifications
  USER_REPORTED = 'user_reported',
  CONTENT_FLAGGED = 'content_flagged',
  MODERATION_ACTION = 'moderation_action',
  
  // General notifications
  ANNOUNCEMENT = 'announcement',
  MAINTENANCE = 'maintenance',
  WELCOME = 'welcome',
}
```

## Notification Channels

```typescript
enum NotificationChannel {
  IN_APP = 'in_app',        // In-app notifications
  PUSH = 'push',            // Push notifications
  EMAIL = 'email',          // Email notifications
  SMS = 'sms',              // SMS notifications (future)
  WEBSOCKET = 'websocket',  // Real-time WebSocket
}
```

## API Endpoints

### Notifications

- `GET /notifications` - Get user notifications with pagination
- `GET /notifications/unread-count` - Get unread notification count
- `PUT /notifications/mark-read` - Mark specific notifications as read
- `PUT /notifications/mark-all-read` - Mark all notifications as read
- `DELETE /notifications/:id` - Delete a notification
- `POST /notifications` - Create notification (admin/system)

### Preferences

- `GET /notifications/preferences` - Get user preferences
- `GET /notifications/preferences/map` - Get preferences organized by type/channel
- `PUT /notifications/preferences` - Update a preference
- `PUT /notifications/preferences/bulk` - Bulk update preferences
- `POST /notifications/preferences/reset` - Reset to defaults
- `PUT /notifications/preferences/disable-all` - Disable all notifications
- `PUT /notifications/preferences/enable-all` - Enable all notifications

### Mutes

- `GET /notifications/mutes` - Get user mutes
- `GET /notifications/mutes/stats` - Get mute statistics
- `POST /notifications/mutes` - Create a mute
- `PUT /notifications/mutes/:id` - Update a mute
- `DELETE /notifications/mutes/:id` - Remove a mute
- `POST /notifications/mutes/user/:userId` - Mute a user
- `DELETE /notifications/mutes/user/:userId` - Unmute a user
- `POST /notifications/mutes/room/:roomId` - Mute a room
- `DELETE /notifications/mutes/room/:roomId` - Unmute a room
- `POST /notifications/mutes/global` - Enable global mute
- `DELETE /notifications/mutes/global` - Disable global mute
- `GET /notifications/mutes/global/status` - Check global mute status

## WebSocket Events

### Client to Server

- `subscribe-to-notifications` - Subscribe to notifications
- `unsubscribe-from-notifications` - Unsubscribe from notifications
- `mark-notification-read` - Mark notification as read
- `get-online-status` - Get user online status

### Server to Client

- `connected` - Connection confirmation
- `new-notification` - New notification received
- `notification-read` - Notification marked as read
- `unread-count-update` - Unread count changed
- `notification-status-update` - Notification status changed
- `broadcast-notification` - System-wide notification
- `force-disconnect` - Server-initiated disconnect

## Usage Examples

### Creating a Notification

```typescript
await notificationService.createNotification({
  recipientId: 'user-id',
  type: NotificationType.MENTION,
  title: 'You were mentioned',
  message: 'You were mentioned in a message',
  senderId: 'sender-id',
  roomId: 'room-id',
  messageId: 'message-id',
  data: { messageContent: 'Hello @username!' },
  actionUrl: '/rooms/room-id/messages/message-id',
  category: 'message',
  priority: 2,
});
```

### Handling Message Notifications

```typescript
// In your MessageService after creating a message
await messageNotificationService.handleNewMessage(
  savedMessage.id,
  savedMessage.content,
  savedMessage.authorId,
  savedMessage.roomId,
  roomMemberIds,
);
```

### Managing User Preferences

```typescript
// Update a preference
await preferenceService.updatePreference(userId, {
  type: NotificationType.MENTION,
  channel: NotificationChannel.PUSH,
  enabled: true,
});

// Bulk update
await preferenceService.bulkUpdatePreferences(userId, {
  preferences: {
    [NotificationType.MESSAGE]: {
      [NotificationChannel.PUSH]: false,
      [NotificationChannel.EMAIL]: true,
    },
  },
});
```

### Muting Users/Rooms

```typescript
// Mute a user for 24 hours
await muteService.muteUser(
  userId,
  targetUserId,
  new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
  'Temporary mute'
);

// Mute a room permanently
await muteService.muteRoom(userId, roomId);

// Enable global mute
await muteService.enableGlobalMute(userId);
```

## Configuration

### Firebase Setup

1. Create a Firebase project
2. Generate a service account key
3. Add configuration to your environment:

```typescript
// config/firebase.config.ts
export default () => ({
  firebase: {
    projectId: process.env.FIREBASE_PROJECT_ID,
    serviceAccountKey: {
      type: 'service_account',
      project_id: process.env.FIREBASE_PROJECT_ID,
      private_key_id: process.env.FIREBASE_PRIVATE_KEY_ID,
      private_key: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      client_email: process.env.FIREBASE_CLIENT_EMAIL,
      client_id: process.env.FIREBASE_CLIENT_ID,
      auth_uri: 'https://accounts.google.com/o/oauth2/auth',
      token_uri: 'https://oauth2.googleapis.com/token',
    },
  },
});
```

### Email Templates

Email templates are located in the `templates/` directory:

- `mention-notification.hbs` - Mention notifications
- `reply-notification.hbs` - Reply notifications
- `generic-notification.hbs` - Generic notifications
- `welcome.hbs` - Welcome emails
- `digest.hbs` - Digest emails

## Database Migration

Run the migration to create the notification tables:

```bash
npm run migration:run
```

The migration creates:
- `notifications` table
- `notification_preferences` table
- `user_mutes` table
- `notification_batches` table
- Appropriate indexes and constraints

## Integration with Existing Services

### Message Service Integration

Add to your `MessageService`:

```typescript
import { MessageNotificationService } from '../notifications/services/message-notification.service';

@Injectable()
export class MessageService {
  constructor(
    // ... existing dependencies
    private readonly messageNotificationService: MessageNotificationService,
  ) {}

  async createMessage(createMessageDto: CreateMessageDto, userId: string) {
    // ... existing logic
    const savedMessage = await this.messageRepository.save(message);

    // Add notification handling
    try {
      const roomMemberIds = await this.getRoomMemberIds(savedMessage.roomId);
      await this.messageNotificationService.handleNewMessage(
        savedMessage.id,
        savedMessage.content,
        savedMessage.authorId,
        savedMessage.roomId,
        roomMemberIds,
      );
    } catch (error) {
      console.error('Failed to send message notifications:', error);
    }

    return this.toResponseDto(savedMessage);
  }
}
```

### Reaction Service Integration

```typescript
// When adding a reaction
await messageNotificationService.handleMessageReaction(
  messageId,
  messageAuthorId,
  reactorId,
  roomId,
  reaction,
  true, // isAdded
);
```

## Cleanup Jobs

The system includes automatic cleanup jobs:

1. **Daily Cleanup** (2 AM) - Removes read notifications older than 30 days
2. **Hourly Cleanup** - Removes expired mutes
3. **Weekly Deep Cleanup** - Removes all notifications older than 90 days

## Performance Considerations

1. **Indexes** - Comprehensive indexing on frequently queried fields
2. **Pagination** - All list endpoints support pagination
3. **Caching** - User preferences and mute status can be cached
4. **Batch Processing** - Large notification sends use batch processing
5. **Queue Processing** - Async notification delivery via Bull queues

## Security Features

1. **User Isolation** - Users can only access their own notifications
2. **Mute Validation** - Proper validation of mute targets
3. **Rate Limiting** - Global rate limiting on API endpoints
4. **Input Validation** - Comprehensive DTO validation
5. **JWT Authentication** - All endpoints require authentication

## Monitoring and Logging

The system includes comprehensive logging:

- Notification creation and delivery
- WebSocket connections and disconnections
- Queue job processing
- Error handling and retry logic
- Performance metrics

## Future Enhancements

1. **SMS Notifications** - Twilio integration
2. **Notification Analytics** - Delivery and engagement metrics
3. **Advanced Batching** - Smart batching based on user activity
4. **Rich Notifications** - Support for images and actions
5. **Notification Scheduling** - Advanced scheduling options
6. **A/B Testing** - Notification content testing
7. **Machine Learning** - Smart notification timing and content

## Testing

The system includes comprehensive test coverage:

- Unit tests for all services
- Integration tests for API endpoints
- WebSocket connection tests
- Queue processing tests
- Database migration tests

Run tests with:

```bash
npm run test
npm run test:e2e
```

## Troubleshooting

### Common Issues

1. **WebSocket Connection Issues**
   - Check JWT token validity
   - Verify CORS configuration
   - Check network connectivity

2. **Push Notification Failures**
   - Verify Firebase configuration
   - Check device token validity
   - Review Firebase console logs

3. **Email Delivery Issues**
   - Check SMTP configuration
   - Verify email templates exist
   - Review mailer service logs

4. **High Memory Usage**
   - Check notification cleanup jobs
   - Review batch processing settings
   - Monitor queue sizes

### Debug Mode

Enable debug logging:

```typescript
// In your environment
DEBUG=notification:*
LOG_LEVEL=debug
```

This comprehensive notification system provides a robust foundation for real-time communication and user engagement in the Whspr Stellar application.