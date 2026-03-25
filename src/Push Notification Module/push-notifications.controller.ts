import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import { PushNotificationService } from '../services/push-notification.service';
import {
  RegisterDeviceDto,
  SendToTopicDto,
  SendToUserDto,
  UnregisterDeviceDto,
} from '../dto/push-notification.dto';

@Controller('push')
export class PushNotificationsController {
  constructor(private readonly pushService: PushNotificationService) {}

  /**
   * POST /push/subscribe
   * Register a device token for push notifications
   */
  @Post('subscribe')
  @HttpCode(HttpStatus.CREATED)
  async subscribe(@Body() dto: RegisterDeviceDto) {
    const result = await this.pushService.registerDevice(
      dto.userId,
      dto.deviceToken,
      dto.platform,
    );
    return {
      success: true,
      data: result,
      message: result.isNew
        ? 'Device registered successfully'
        : 'Device subscription reactivated',
    };
  }

  /**
   * DELETE /push/subscribe
   * Unregister a device token
   */
  @Delete('subscribe')
  @HttpCode(HttpStatus.OK)
  async unsubscribe(@Body() dto: UnregisterDeviceDto) {
    await this.pushService.unregisterDevice(dto.userId, dto.deviceToken);
    return { success: true, message: 'Device unregistered successfully' };
  }

  /**
   * GET /push/subscriptions?userId=...
   * List all subscriptions for a user
   */
  @Get('subscriptions')
  async getSubscriptions(@Query('userId') userId: string) {
    const subscriptions = await this.pushService.getUserSubscriptions(userId);
    return {
      success: true,
      data: subscriptions,
      total: subscriptions.length,
    };
  }

  /**
   * POST /push/send/user
   * Enqueue push notification to a single user (async)
   */
  @Post('send/user')
  @HttpCode(HttpStatus.ACCEPTED)
  async sendToUser(@Body() dto: SendToUserDto) {
    await this.pushService.sendToUser(
      dto.userId,
      {
        title: dto.title,
        body: dto.body,
        data: dto.data,
        imageUrl: dto.imageUrl,
      },
      dto.notificationType,
    );
    return { success: true, message: 'Notification queued for delivery' };
  }

  /**
   * POST /push/send/topic
   * Enqueue push notification to a topic (async)
   */
  @Post('send/topic')
  @HttpCode(HttpStatus.ACCEPTED)
  async sendToTopic(@Body() dto: SendToTopicDto) {
    await this.pushService.sendToTopic(dto.topic, {
      title: dto.title,
      body: dto.body,
      data: dto.data,
      imageUrl: dto.imageUrl,
    });
    return { success: true, message: 'Topic notification queued for delivery' };
  }
}
