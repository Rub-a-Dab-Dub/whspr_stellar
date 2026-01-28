import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NotificationPreference } from '../entities/notification-preference.entity';
import { UpdateNotificationPreferenceDto, BulkUpdatePreferencesDto } from '../dto/notification-preference.dto';
import { NotificationType } from '../enums/notification-type.enum';
import { NotificationChannel } from '../enums/notification-channel.enum';

@Injectable()
export class NotificationPreferenceService {
  private readonly logger = new Logger(NotificationPreferenceService.name);

  constructor(
    @InjectRepository(NotificationPreference)
    private readonly preferenceRepository: Repository<NotificationPreference>,
  ) {}

  /**
   * Get user's notification preferences
   */
  async getUserPreferences(userId: string): Promise<NotificationPreference[]> {
    return this.preferenceRepository.find({
      where: { userId },
      order: { type: 'ASC', channel: 'ASC' },
    });
  }

  /**
   * Get user's preferences organized by type and channel
   */
  async getUserPreferencesMap(userId: string): Promise<Record<string, Record<string, NotificationPreference>>> {
    const preferences = await this.getUserPreferences(userId);
    const map: Record<string, Record<string, NotificationPreference>> = {};

    for (const preference of preferences) {
      if (!map[preference.type]) {
        map[preference.type] = {};
      }
      map[preference.type][preference.channel] = preference;
    }

    return map;
  }

  /**
   * Update a specific notification preference
   */
  async updatePreference(
    userId: string,
    updateDto: UpdateNotificationPreferenceDto,
  ): Promise<NotificationPreference> {
    const { type, channel, enabled, settings } = updateDto;

    let preference = await this.preferenceRepository.findOne({
      where: { userId, type, channel },
    });

    if (preference) {
      preference.enabled = enabled;
      if (settings) {
        preference.settings = settings;
      }
    } else {
      preference = this.preferenceRepository.create({
        userId,
        type,
        channel,
        enabled,
        settings: settings || {},
      });
    }

    const savedPreference = await this.preferenceRepository.save(preference);
    this.logger.log(`Updated notification preference for user ${userId}: ${type}/${channel} = ${enabled}`);
    
    return savedPreference;
  }

  /**
   * Bulk update preferences
   */
  async bulkUpdatePreferences(
    userId: string,
    bulkUpdateDto: BulkUpdatePreferencesDto,
  ): Promise<NotificationPreference[]> {
    const { preferences } = bulkUpdateDto;
    
    if (!preferences) {
      return [];
    }

    const updatedPreferences: NotificationPreference[] = [];

    for (const [type, channels] of Object.entries(preferences)) {
      for (const [channel, enabled] of Object.entries(channels)) {
        const preference = await this.updatePreference(userId, {
          type: type as NotificationType,
          channel: channel as NotificationChannel,
          enabled,
        });
        updatedPreferences.push(preference);
      }
    }

    return updatedPreferences;
  }

  /**
   * Initialize default preferences for a new user
   */
  async initializeDefaultPreferences(userId: string): Promise<NotificationPreference[]> {
    const defaultPreferences = this.getDefaultPreferences();
    const preferences: NotificationPreference[] = [];

    for (const defaultPref of defaultPreferences) {
      const preference = this.preferenceRepository.create({
        userId,
        ...defaultPref,
      });
      preferences.push(preference);
    }

    const savedPreferences = await this.preferenceRepository.save(preferences);
    this.logger.log(`Initialized default notification preferences for user ${userId}`);
    
    return savedPreferences;
  }

  /**
   * Check if user has preference enabled for specific type and channel
   */
  async isPreferenceEnabled(
    userId: string,
    type: NotificationType,
    channel: NotificationChannel,
  ): Promise<boolean> {
    const preference = await this.preferenceRepository.findOne({
      where: { userId, type, channel },
    });

    return preference?.enabled ?? this.getDefaultPreferenceValue(type, channel);
  }

  /**
   * Get default preferences configuration
   */
  private getDefaultPreferences(): Partial<NotificationPreference>[] {
    const defaults: Partial<NotificationPreference>[] = [];

    // Message notifications
    defaults.push(
      { type: NotificationType.MESSAGE, channel: NotificationChannel.IN_APP, enabled: true },
      { type: NotificationType.MESSAGE, channel: NotificationChannel.WEBSOCKET, enabled: true },
      { type: NotificationType.MESSAGE, channel: NotificationChannel.PUSH, enabled: false },
      { type: NotificationType.MESSAGE, channel: NotificationChannel.EMAIL, enabled: false },
    );

    // Mention notifications (higher priority)
    defaults.push(
      { type: NotificationType.MENTION, channel: NotificationChannel.IN_APP, enabled: true },
      { type: NotificationType.MENTION, channel: NotificationChannel.WEBSOCKET, enabled: true },
      { type: NotificationType.MENTION, channel: NotificationChannel.PUSH, enabled: true },
      { type: NotificationType.MENTION, channel: NotificationChannel.EMAIL, enabled: false },
    );

    // Reply notifications
    defaults.push(
      { type: NotificationType.REPLY, channel: NotificationChannel.IN_APP, enabled: true },
      { type: NotificationType.REPLY, channel: NotificationChannel.WEBSOCKET, enabled: true },
      { type: NotificationType.REPLY, channel: NotificationChannel.PUSH, enabled: true },
      { type: NotificationType.REPLY, channel: NotificationChannel.EMAIL, enabled: false },
    );

    // Reaction notifications
    defaults.push(
      { type: NotificationType.REACTION, channel: NotificationChannel.IN_APP, enabled: true },
      { type: NotificationType.REACTION, channel: NotificationChannel.WEBSOCKET, enabled: true },
      { type: NotificationType.REACTION, channel: NotificationChannel.PUSH, enabled: false },
      { type: NotificationType.REACTION, channel: NotificationChannel.EMAIL, enabled: false },
    );

    // System notifications
    defaults.push(
      { type: NotificationType.LEVEL_UP, channel: NotificationChannel.IN_APP, enabled: true },
      { type: NotificationType.LEVEL_UP, channel: NotificationChannel.WEBSOCKET, enabled: true },
      { type: NotificationType.LEVEL_UP, channel: NotificationChannel.PUSH, enabled: true },
      { type: NotificationType.ACHIEVEMENT_UNLOCKED, channel: NotificationChannel.IN_APP, enabled: true },
      { type: NotificationType.ACHIEVEMENT_UNLOCKED, channel: NotificationChannel.WEBSOCKET, enabled: true },
      { type: NotificationType.ACHIEVEMENT_UNLOCKED, channel: NotificationChannel.PUSH, enabled: true },
    );

    // Room notifications
    defaults.push(
      { type: NotificationType.ROOM_INVITATION, channel: NotificationChannel.IN_APP, enabled: true },
      { type: NotificationType.ROOM_INVITATION, channel: NotificationChannel.WEBSOCKET, enabled: true },
      { type: NotificationType.ROOM_INVITATION, channel: NotificationChannel.PUSH, enabled: true },
      { type: NotificationType.ROOM_INVITATION, channel: NotificationChannel.EMAIL, enabled: true },
    );

    // Security notifications (always enabled)
    defaults.push(
      { type: NotificationType.LOGIN_SUCCESS, channel: NotificationChannel.EMAIL, enabled: true },
      { type: NotificationType.LOGIN_FAILED, channel: NotificationChannel.EMAIL, enabled: true },
      { type: NotificationType.PASSWORD_CHANGED, channel: NotificationChannel.EMAIL, enabled: true },
      { type: NotificationType.EMAIL_CHANGED, channel: NotificationChannel.EMAIL, enabled: true },
    );

    return defaults;
  }

  /**
   * Get default preference value for type and channel
   */
  private getDefaultPreferenceValue(type: NotificationType, channel: NotificationChannel): boolean {
    const defaults = this.getDefaultPreferences();
    const defaultPref = defaults.find(p => p.type === type && p.channel === channel);
    return defaultPref?.enabled ?? false;
  }

  /**
   * Reset user preferences to defaults
   */
  async resetToDefaults(userId: string): Promise<NotificationPreference[]> {
    // Delete existing preferences
    await this.preferenceRepository.delete({ userId });

    // Initialize with defaults
    return this.initializeDefaultPreferences(userId);
  }

  /**
   * Disable all notifications for a user
   */
  async disableAllNotifications(userId: string): Promise<void> {
    await this.preferenceRepository.update(
      { userId },
      { enabled: false },
    );

    this.logger.log(`Disabled all notifications for user ${userId}`);
  }

  /**
   * Enable all notifications for a user
   */
  async enableAllNotifications(userId: string): Promise<void> {
    await this.preferenceRepository.update(
      { userId },
      { enabled: true },
    );

    this.logger.log(`Enabled all notifications for user ${userId}`);
  }
}