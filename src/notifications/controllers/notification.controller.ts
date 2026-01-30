import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  HttpStatus,
  HttpCode,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { NotificationService } from '../services/notification.service';
import { NotificationPreferenceService } from '../services/notification-preference.service';
import { PushNotificationService } from '../services/push-notification.service';
import { CreateNotificationDto } from '../dto/create-notification.dto';
import {
  GetNotificationsDto,
  UpdateNotificationPreferenceDto,
  BulkUpdatePreferencesDto,
  MuteUserDto,
  MuteRoomDto,
} from '../dto/notification-preferences.dto';
import { CreatePushSubscriptionDto } from '../dto/push-subscription.dto';
import { User } from '../../user/entities/user.entity';

@Controller('notifications')
@UseGuards(JwtAuthGuard)
export class NotificationController {
  constructor(
    private readonly notificationService: NotificationService,
    private readonly preferenceService: NotificationPreferenceService,
    private readonly pushService: PushNotificationService,
  ) {}

  /**
   * Get user's notifications
   */
  @Get()
  async getNotifications(
    @CurrentUser() user: User,
    @Query() query: GetNotificationsDto,
  ) {
    const result = await this.notificationService.getNotifications(user.id, query);
    
    return {
      success: true,
      data: result,
    };
  }

  /**
   * Get unread notifications count
   */
  @Get('unread-count')
  async getUnreadCount(@CurrentUser() user: User) {
    const result = await this.notificationService.getNotifications(user.id, { 
      unreadOnly: true,
      limit: '1',
    });
    
    return {
      success: true,
      data: {
        unreadCount: result.unreadCount,
      },
    };
  }

  /**
   * Mark notification as read
   */
  @Put(':id/read')
  @HttpCode(HttpStatus.NO_CONTENT)
  async markAsRead(
    @Param('id') notificationId: string,
    @CurrentUser() user: User,
  ) {
    await this.notificationService.markAsRead(notificationId, user.id);
  }

  /**
   * Mark all notifications as read
   */
  @Put('mark-all-read')
  async markAllAsRead(@CurrentUser() user: User) {
    const markedCount = await this.notificationService.markAllAsRead(user.id);
    
    return {
      success: true,
      data: {
        markedCount,
      },
    };
  }

  /**
   * Delete notification
   */
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteNotification(
    @Param('id') notificationId: string,
    @CurrentUser() user: User,
  ) {
    await this.notificationService.deleteNotification(notificationId, user.id);
  }

  /**
   * Create notification (admin/system use)
   */
  @Post()
  async createNotification(
    @Body() createNotificationDto: CreateNotificationDto,
    @CurrentUser() user: User,
  ) {
    // Set sender to current user if not specified
    if (!createNotificationDto.senderId) {
      createNotificationDto.senderId = user.id;
    }

    const notification = await this.notificationService.createNotification(createNotificationDto);
    
    return {
      success: true,
      data: notification,
    };
  }

  // Notification Preferences

  /**
   * Get user's notification preferences
   */
  @Get('preferences')
  async getPreferences(@CurrentUser() user: User) {
    const preferences = await this.preferenceService.getUserPreferences(user.id);
    
    return {
      success: true,
      data: preferences,
    };
  }

  /**
   * Update notification preference
   */
  @Put('preferences')
  async updatePreference(
    @Body() updateDto: UpdateNotificationPreferenceDto,
    @CurrentUser() user: User,
  ) {
    const preference = await this.preferenceService.updatePreference(user.id, updateDto);
    
    return {
      success: true,
      data: preference,
    };
  }

  /**
   * Bulk update notification preferences
   */
  @Put('preferences/bulk')
  async bulkUpdatePreferences(
    @Body() bulkUpdateDto: BulkUpdatePreferencesDto,
    @CurrentUser() user: User,
  ) {
    const preferences = await this.preferenceService.bulkUpdatePreferences(user.id, bulkUpdateDto);
    
    return {
      success: true,
      data: preferences,
    };
  }

  /**
   * Initialize default preferences
   */
  @Post('preferences/initialize')
  async initializePreferences(@CurrentUser() user: User) {
    const preferences = await this.preferenceService.initializeDefaultPreferences(user.id);
    
    return {
      success: true,
      data: preferences,
    };
  }

  // Mute/Unmute functionality

  /**
   * Mute user
   */
  @Post('mute/user')
  @HttpCode(HttpStatus.NO_CONTENT)
  async muteUser(
    @Body() muteUserDto: MuteUserDto,
    @CurrentUser() user: User,
  ) {
    await this.preferenceService.muteUser(user.id, muteUserDto.userId);
  }

  /**
   * Unmute user
   */
  @Delete('mute/user/:userId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async unmuteUser(
    @Param('userId') userId: string,
    @CurrentUser() user: User,
  ) {
    await this.preferenceService.unmuteUser(user.id, userId);
  }

  /**
   * Mute room
   */
  @Post('mute/room')
  @HttpCode(HttpStatus.NO_CONTENT)
  async muteRoom(
    @Body() muteRoomDto: MuteRoomDto,
    @CurrentUser() user: User,
  ) {
    await this.preferenceService.muteRoom(user.id, muteRoomDto.roomId);
  }

  /**
   * Unmute room
   */
  @Delete('mute/room/:roomId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async unmuteRoom(
    @Param('roomId') roomId: string,
    @CurrentUser() user: User,
  ) {
    await this.preferenceService.unmuteRoom(user.id, roomId);
  }

  /**
   * Get muted users
   */
  @Get('muted/users')
  async getMutedUsers(@CurrentUser() user: User) {
    const mutedUsers = await this.preferenceService.getMutedUsers(user.id);
    
    return {
      success: true,
      data: mutedUsers,
    };
  }

  /**
   * Get muted rooms
   */
  @Get('muted/rooms')
  async getMutedRooms(@CurrentUser() user: User) {
    const mutedRooms = await this.preferenceService.getMutedRooms(user.id);
    
    return {
      success: true,
      data: mutedRooms,
    };
  }

  // Push Notifications

  /**
   * Subscribe to push notifications
   */
  @Post('push/subscribe')
  async subscribeToPush(
    @Body() subscriptionDto: CreatePushSubscriptionDto,
    @CurrentUser() user: User,
  ) {
    const subscription = await this.pushService.subscribe(user.id, subscriptionDto);
    
    return {
      success: true,
      data: subscription,
    };
  }

  /**
   * Unsubscribe from push notifications
   */
  @Delete('push/unsubscribe')
  @HttpCode(HttpStatus.NO_CONTENT)
  async unsubscribeFromPush(
    @Body() body: { endpoint: string },
    @CurrentUser() user: User,
  ) {
    await this.pushService.unsubscribe(user.id, body.endpoint);
  }

  /**
   * Get user's push subscriptions
   */
  @Get('push/subscriptions')
  async getPushSubscriptions(@CurrentUser() user: User) {
    const subscriptions = await this.pushService.getUserSubscriptions(user.id);
    
    return {
      success: true,
      data: subscriptions,
    };
  }

  /**
   * Test push notification
   */
  @Post('push/test')
  async testPushNotification(@CurrentUser() user: User) {
    const result = await this.pushService.testPushNotification(user.id);
    
    return {
      success: true,
      data: result,
    };
  }
}