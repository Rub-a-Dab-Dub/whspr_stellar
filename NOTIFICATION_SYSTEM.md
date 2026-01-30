# Notification System Implementation

This document describes the comprehensive notification system implemented for Whspr Stellar.

## Features Implemented

### ✅ Core Notification System
- **Notification Entity**: Complete notification storage with metadata, priorities, and expiration
- **Notification Types**: Message, mention, reply, reaction, room invite, reward, level up, achievement, system
- **Real-time Delivery**: WebSocket gateway for instant notifications
- **Notification Service**: Full CRUD operations with caching and optimization

### ✅ User Preferences
- **Notification Preferences**: Per-type, per-channel preference management
- **Multiple Channels**: In-app, push, email, SMS support
- **Quiet Hours**: Time-based notification muting
- **Mute/Unmute**: User and room-specific muting functionality
- **Default Preferences**: Automatic setup for new users

### ✅ Push Notifications
- **Web Push**: Complete web push notification support using VAPID
- **Subscription Management**: Device registration and cleanup
- **Push Service**: Firebase-compatible push notification delivery
- **Device Tracking**: Multiple device support per user

### ✅ Email Notifications
- **Email Templates**: Handlebars templates for different notification types
- **Email Service**: Integrated with NestJS Mailer
- **Digest Emails**: Daily and weekly notification summaries
- **Unsubscribe**: Email preference management

### ✅ Real-time Features
- **WebSocket Gateway**: Dedicated `/notifications` namespace
- **Live Updates**: Real-time notification delivery and read status
- **Connection Management**: User session tracking
- **Event Broadcasting**: Multi-device notification sync

### ✅ Mention Detection
- **@username Detection**: Automatic mention parsing in messages
- **User Lookup**: Username to user ID resolution
- **Mention Formatting**: Rich mention formatting support
- **Notification Creation**: Automatic mention notifications

### ✅ Notification Batching
- **Immediate Batching**: 5-minute batching for high-frequency notifications
- **Daily Digest**: Automated daily summary emails
- **Weekly Digest**: Weekly notification summaries
- **Smart Batching**: Threshold-based batching (3+ notifications)

### ✅ Cleanup & Maintenance
- **Expired Notifications**: Automatic cleanup of expired notifications
- **Old Notifications**: Cleanup of read notifications after 90 days
- **Push Subscriptions**: Inactive subscription cleanup
- **Statistics**: Daily notification statistics generation

### ✅ Integration Points
- **Message Integration**: Automatic notifications for new messages and mentions
- **Reaction Integration**: Notification on message reactions
- **Queue Integration**: Background processing for email/push delivery
- **Cache Integration**: Redis caching for performance optimization

## API Endpoints

### Notifications
- `GET /notifications` - Get user notifications with pagination
- `GET /notifications/unread-count` - Get unread notification count
- `PUT /notifications/:id/read` - Mark notification as read
- `PUT /notifications/mark-all-read` - Mark all notifications as read
- `DELETE /notifications/:id` - Delete notification
- `POST /notifications` - Create notification (admin/system)

### Preferences
- `GET /notifications/preferences` - Get user preferences
- `PUT /notifications/preferences` - Update single preference
- `PUT /notifications/preferences/bulk` - Bulk update preferences
- `POST /notifications/preferences/initialize` - Initialize default preferences

### Muting
- `POST /notifications/mute/user` - Mute user
- `DELETE /notifications/mute/user/:userId` - Unmute user
- `POST /notifications/mute/room` - Mute room
- `DELETE /notifications/mute/room/:roomId` - Unmute room
- `GET /notifications/muted/users` - Get muted users
- `GET /notifications/muted/rooms` - Get muted rooms

### Push Notifications
- `POST /notifications/push/subscribe` - Subscribe to push notifications
- `DELETE /notifications/push/unsubscribe` - Unsubscribe from push
- `GET /notifications/push/subscriptions` - Get user subscriptions
- `POST /notifications/push/test` - Test push notification

## WebSocket Events

### Client to Server
- `subscribe-notifications` - Subscribe to notifications
- `mark-notification-read` - Mark notification as read
- `mark-all-read` - Mark all notifications as read
- `get-notifications` - Get notifications with pagination

### Server to Client
- `new-notification` - New notification received
- `notification-read` - Notification marked as read
- `all-notifications-read` - All notifications marked as read
- `unread-count-updated` - Unread count changed
- `notifications-data` - Notification list response
- `subscribed` - Subscription confirmed
- `error` - Error occurred

## Database Schema

### notifications
- `id` (UUID, Primary Key)
- `recipientId` (UUID, Foreign Key to users)
- `senderId` (UUID, Foreign Key to users, nullable)
- `type` (Enum: message, mention, reply, reaction, etc.)
- `title` (VARCHAR 255)
- `message` (TEXT)
- `data` (JSONB, nullable)
- `priority` (Enum: low, normal, high, urgent)
- `isRead` (BOOLEAN, default false)
- `readAt` (TIMESTAMP, nullable)
- `actionUrl` (VARCHAR 500, nullable)
- `imageUrl` (VARCHAR 500, nullable)
- `expiresAt` (TIMESTAMP, nullable)
- `isDeleted` (BOOLEAN, default false)
- `deletedAt` (TIMESTAMP, nullable)
- `createdAt` (TIMESTAMP)
- `updatedAt` (TIMESTAMP)

### notification_preferences
- `id` (UUID, Primary Key)
- `userId` (UUID, Foreign Key to users)
- `type` (Enum: notification types)
- `channel` (Enum: in_app, push, email, sms)
- `isEnabled` (BOOLEAN, default true)
- `quietHoursStart` (TIME, nullable)
- `quietHoursEnd` (TIME, nullable)
- `mutedRooms` (TEXT[], nullable)
- `mutedUsers` (TEXT[], nullable)
- `createdAt` (TIMESTAMP)
- `updatedAt` (TIMESTAMP)

### push_subscriptions
- `id` (UUID, Primary Key)
- `userId` (UUID, Foreign Key to users)
- `endpoint` (VARCHAR 500)
- `p256dhKey` (TEXT)
- `authKey` (TEXT)
- `deviceType` (VARCHAR 50, nullable)
- `deviceName` (VARCHAR 100, nullable)
- `userAgent` (TEXT, nullable)
- `isActive` (BOOLEAN, default true)
- `lastUsedAt` (TIMESTAMP, nullable)
- `createdAt` (TIMESTAMP)
- `updatedAt` (TIMESTAMP)

## Configuration

### Environment Variables
```env
# VAPID Keys for Push Notifications
VAPID_PUBLIC_KEY=your_vapid_public_key
VAPID_PRIVATE_KEY=your_vapid_private_key
VAPID_SUBJECT=mailto:admin@whspr.com

# Email Configuration
MAIL_HOST=smtp.gmail.com
MAIL_PORT=587
MAIL_USER=your_email@gmail.com
MAIL_PASSWORD=your_app_password
MAIL_FROM=noreply@whspr.com

# App Configuration
APP_URL=https://whspr.com
CORS_ORIGIN=https://whspr.com
```

## Usage Examples

### Creating Notifications
```typescript
// Inject the notification service
constructor(
  private readonly notificationService: NotificationService,
) {}

// Create a mention notification
await this.notificationService.createNotification({
  recipientId: 'user-id',
  senderId: 'sender-id',
  type: NotificationType.MENTION,
  title: 'You were mentioned',
  message: 'Someone mentioned you in a message',
  data: { messageId: 'msg-id', roomId: 'room-id' },
  actionUrl: '/rooms/room-id/messages/msg-id',
});
```

### Integration Service
```typescript
// Use the integration service for common notifications
constructor(
  private readonly integrationService: NotificationIntegrationService,
) {}

// Initialize user preferences
await this.integrationService.initializeUserNotifications(userId);

// Send room invitation
await this.integrationService.notifyRoomInvitation(
  recipientId,
  senderId,
  'Room Name',
  'room-id',
  '/rooms/room-id/join'
);

// Send reward notification
await this.integrationService.notifyRewardGranted(
  userId,
  'Daily Login Bonus',
  '100 XP',
  'Keep up the streak!'
);
```

### WebSocket Client
```javascript
// Connect to notifications
const socket = io('/notifications', {
  auth: { token: 'jwt-token' }
});

// Subscribe to notifications
socket.emit('subscribe-notifications');

// Listen for new notifications
socket.on('new-notification', (notification) => {
  console.log('New notification:', notification);
  // Update UI
});

// Listen for unread count updates
socket.on('unread-count-updated', ({ unreadCount }) => {
  console.log('Unread count:', unreadCount);
  // Update badge
});

// Mark notification as read
socket.emit('mark-notification-read', { notificationId: 'notification-id' });
```

## Scheduled Jobs

### Cleanup Jobs (Daily at 2 AM)
- Clean up expired notifications
- Remove old deleted notifications (30+ days)
- Remove old read notifications (90+ days)
- Clean up inactive push subscriptions

### Batching Jobs
- **Every 5 minutes**: Process immediate notification batches
- **Daily at 8 AM**: Send daily digest emails
- **Weekly on Monday at 9 AM**: Send weekly digest emails

### Statistics (Daily at Midnight)
- Generate daily notification statistics
- Track creation, read, and unread counts

## Performance Optimizations

### Caching
- Redis caching for notification counts and user preferences
- Cache invalidation on updates
- Batch cache operations for multiple notifications

### Database Indexes
- Composite indexes on frequently queried columns
- Optimized queries for pagination and filtering
- Efficient foreign key relationships

### Queue Processing
- Background processing for email and push notifications
- Retry logic with exponential backoff
- Job prioritization and cleanup

## Security Considerations

### Authentication
- JWT token validation for WebSocket connections
- User authorization for notification access
- Secure VAPID key management

### Data Privacy
- User preference respect for all channels
- Secure unsubscribe token generation
- PII handling in email templates

### Rate Limiting
- Notification creation rate limiting
- Push notification throttling
- Email sending limits

## Testing

### Unit Tests
- Service method testing
- DTO validation testing
- Database operation testing

### Integration Tests
- WebSocket connection testing
- Email template rendering
- Push notification delivery

### E2E Tests
- Complete notification flow testing
- User preference management
- Real-time delivery verification

## Monitoring & Logging

### Metrics
- Notification creation rates
- Delivery success rates
- User engagement metrics

### Logging
- Structured logging for all operations
- Error tracking and alerting
- Performance monitoring

### Health Checks
- Database connectivity
- Redis connectivity
- Email service availability
- Push service availability

## Future Enhancements

### Planned Features
- SMS notifications via Twilio
- Advanced notification scheduling
- Rich notification content (images, actions)
- Notification analytics dashboard
- A/B testing for notification content

### Scalability Improvements
- Horizontal scaling for WebSocket connections
- Database sharding for large user bases
- CDN integration for notification assets
- Advanced caching strategies

## Migration Guide

### Database Migration
```bash
# Run the notification tables migration
npm run migration:run
```

### Environment Setup
1. Add required environment variables
2. Configure VAPID keys for push notifications
3. Set up email service credentials
4. Update CORS settings for WebSocket connections

### Integration Steps
1. Import NotificationsModule in your app module
2. Inject NotificationIntegrationService where needed
3. Update existing message/reaction services
4. Add WebSocket client code to frontend
5. Implement push notification subscription in frontend

This notification system provides a robust, scalable foundation for real-time user engagement in the Whspr Stellar application.