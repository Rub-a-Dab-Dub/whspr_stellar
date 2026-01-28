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
import { User } from '../../users/entities/user.entity';
import { NotificationService } from '../services/notification.service';
import { NotificationPreferenceService } from '../services/notification-preference.service';
import { MuteService } from '../services/mute.service';
import { CreateNotificationDto } from '../dto/create-notification.dto';
import { NotificationQueryDto } from '../dto/notification-query.dto';
import { MarkReadDto, MarkAllReadDto } from '../dto/mark-read.dto';
import { UpdateNotificationPreferenceDto, BulkUpdatePreferencesDto } from '../dto/notification-preference.dto';
import { CreateMuteDto, UpdateMuteDto } from '../dto/mute.dto';

@Controller('notifications')
@UseGuards(JwtAuthGuard)
export class NotificationController {
  constructor(
    private readonly notificationService: NotificationService,
    private readonly preferenceService: NotificationPreferenceService,
    private readonly muteService: MuteService,
  ) {}

  /**
   * Get user's notifications with pagination and filtering
   */
  @Get()
  async getNotifications(
    @CurrentUser() user: User,
    @Query() query: NotificationQueryDto,
  ) {
    return this.notificationService.getNotifications(user.id!, query);
  }

  /**
   * Get unread notification count
   */
  @Get('unread-count')
  async getUnreadCount(
    @CurrentUser() user: User,
    @Query('roomId') roomId?: string,
  ) {
    const count = await this.notificationService.getUnreadCount(user.id!, roomId);
    return { unreadCount: count };
  }

  /**
   * Mark notifications as read
   */
  @Put('mark-read')
  @HttpCode(HttpStatus.NO_CONTENT)
  async markAsRead(
    @CurrentUser() user: User,
    @Body() markReadDto: MarkReadDto,
  ) {
    await this.notificationService.markAsRead(user.id!, markReadDto);
  }

  /**
   * Mark all notifications as read
   */
  @Put('mark-all-read')
  @HttpCode(HttpStatus.NO_CONTENT)
  async markAllAsRead(
    @CurrentUser() user: User,
    @Body() markAllReadDto: MarkAllReadDto,
  ) {
    await this.notificationService.markAllAsRead(user.id!, markAllReadDto);
  }

  /**
   * Delete a notification
   */
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteNotification(
    @CurrentUser() user: User,
    @Param('id') notificationId: string,
  ) {
    await this.notificationService.deleteNotification(user.id!, notificationId);
  }

  /**
   * Create a notification (admin/system use)
   */
  @Post()
  async createNotification(@Body() createNotificationDto: CreateNotificationDto) {
    return this.notificationService.createNotification(createNotificationDto);
  }

  // Notification Preferences Endpoints

  /**
   * Get user's notification preferences
   */
  @Get('preferences')
  async getPreferences(@CurrentUser() user: User) {
    return this.preferenceService.getUserPreferences(user.id!);
  }

  /**
   * Get user's preferences organized by type and channel
   */
  @Get('preferences/map')
  async getPreferencesMap(@CurrentUser() user: User) {
    return this.preferenceService.getUserPreferencesMap(user.id!);
  }

  /**
   * Update a notification preference
   */
  @Put('preferences')
  async updatePreference(
    @CurrentUser() user: User,
    @Body() updateDto: UpdateNotificationPreferenceDto,
  ) {
    return this.preferenceService.updatePreference(user.id!, updateDto);
  }

  /**
   * Bulk update notification preferences
   */
  @Put('preferences/bulk')
  async bulkUpdatePreferences(
    @CurrentUser() user: User,
    @Body() bulkUpdateDto: BulkUpdatePreferencesDto,
  ) {
    return this.preferenceService.bulkUpdatePreferences(user.id!, bulkUpdateDto);
  }

  /**
   * Reset preferences to defaults
   */
  @Post('preferences/reset')
  async resetPreferences(@CurrentUser() user: User) {
    return this.preferenceService.resetToDefaults(user.id!);
  }

  /**
   * Disable all notifications
   */
  @Put('preferences/disable-all')
  @HttpCode(HttpStatus.NO_CONTENT)
  async disableAllNotifications(@CurrentUser() user: User) {
    await this.preferenceService.disableAllNotifications(user.id!);
  }

  /**
   * Enable all notifications
   */
  @Put('preferences/enable-all')
  @HttpCode(HttpStatus.NO_CONTENT)
  async enableAllNotifications(@CurrentUser() user: User) {
    await this.preferenceService.enableAllNotifications(user.id!);
  }

  // Mute/Unmute Endpoints

  /**
   * Get user's mutes
   */
  @Get('mutes')
  async getMutes(@CurrentUser() user: User) {
    return this.muteService.getUserMutes(user.id!);
  }

  /**
   * Get mute statistics
   */
  @Get('mutes/stats')
  async getMuteStats(@CurrentUser() user: User) {
    return this.muteService.getMuteStats(user.id!);
  }

  /**
   * Create a mute
   */
  @Post('mutes')
  async createMute(
    @CurrentUser() user: User,
    @Body() createMuteDto: CreateMuteDto,
  ) {
    return this.muteService.createMute(user.id!, createMuteDto);
  }

  /**
   * Update a mute
   */
  @Put('mutes/:id')
  async updateMute(
    @CurrentUser() user: User,
    @Param('id') muteId: string,
    @Body() updateMuteDto: UpdateMuteDto,
  ) {
    return this.muteService.updateMute(user.id!, muteId, updateMuteDto);
  }

  /**
   * Remove a mute
   */
  @Delete('mutes/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async removeMute(
    @CurrentUser() user: User,
    @Param('id') muteId: string,
  ) {
    await this.muteService.removeMute(user.id!, muteId);
  }

  /**
   * Mute a user
   */
  @Post('mutes/user/:userId')
  async muteUser(
    @CurrentUser() user: User,
    @Param('userId') targetUserId: string,
    @Body() body: { expiresAt?: string; reason?: string },
  ) {
    return this.muteService.muteUser(user.id!, targetUserId, body.expiresAt, body.reason);
  }

  /**
   * Unmute a user
   */
  @Delete('mutes/user/:userId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async unmuteUser(
    @CurrentUser() user: User,
    @Param('userId') targetUserId: string,
  ) {
    await this.muteService.unmuteUser(user.id!, targetUserId);
  }

  /**
   * Mute a room
   */
  @Post('mutes/room/:roomId')
  async muteRoom(
    @CurrentUser() user: User,
    @Param('roomId') roomId: string,
    @Body() body: { expiresAt?: string; reason?: string },
  ) {
    return this.muteService.muteRoom(user.id!, roomId, body.expiresAt, body.reason);
  }

  /**
   * Unmute a room
   */
  @Delete('mutes/room/:roomId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async unmuteRoom(
    @CurrentUser() user: User,
    @Param('roomId') roomId: string,
  ) {
    await this.muteService.unmuteRoom(user.id!, roomId);
  }

  /**
   * Enable global mute (mute all notifications)
   */
  @Post('mutes/global')
  async enableGlobalMute(
    @CurrentUser() user: User,
    @Body() body: { expiresAt?: string; reason?: string },
  ) {
    return this.muteService.enableGlobalMute(user.id!, body.expiresAt, body.reason);
  }

  /**
   * Disable global mute
   */
  @Delete('mutes/global')
  @HttpCode(HttpStatus.NO_CONTENT)
  async disableGlobalMute(@CurrentUser() user: User) {
    await this.muteService.disableGlobalMute(user.id!);
  }

  /**
   * Check if user has global mute enabled
   */
  @Get('mutes/global/status')
  async getGlobalMuteStatus(@CurrentUser() user: User) {
    const hasGlobalMute = await this.muteService.hasGlobalMute(user.id!);
    return { hasGlobalMute };
  }
}