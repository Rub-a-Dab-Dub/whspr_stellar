import {
  Injectable,
  NotFoundException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NotificationPreference } from '../entities/notification-preference.entity';
import { UpdateNotificationPreferenceDto, BulkUpdatePreferencesDto } from '../dto/notification-preferences.dto';
import { NotificationType, NotificationChannel } from '../enums/notification-type.enum';

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
   * Get user's preferences for specific notification type
   */
  async getPreferencesForType(
    userId: string,
    type: NotificationType,
  ): Promise<NotificationPreference[]> {
    return this.preferenceRepository.find({
      where: { userId, type },
      order: { channel: 'ASC' },
    });
  }

  /**
   * Update notification preference
   */
  async updatePreference(
    userId: string,
    updateDto: UpdateNotificationPreferenceDto,
  ): Promise<NotificationPreference> {
    let preference = await this.preferenceRepository.findOne({
      where: {
        userId,
        type: updateDto.type,
        channel: updateDto.channel,
      },
    });

    if (preference) {
      // Update existing preference
      Object.assign(preference, updateDto);
    } else {
      // Create new preference
      preference = this.preferenceRepository.create({
        userId,
        ...updateDto,
      });
    }

    const savedPreference = await this.preferenceRepository.save(preference);
    this.logger.log(`Updated notification preference for user ${userId}: ${updateDto.type}/${updateDto.channel}`);
    
    return savedPreference;
  }

  /**
   * Bulk update preferences
   */
  async bulkUpdatePreferences(
    userId: string,
    bulkUpdateDto: BulkUpdatePreferencesDto,
  ): Promise<NotificationPreference[]> {
    const updatedPreferences: NotificationPreference[] = [];

    for (const preferenceDto of bulkUpdateDto.preferences) {
      const preference = await this.updatePreference(userId, preferenceDto);
      updatedPreferences.push(preference);
    }

    return updatedPreferences;
  }

  /**
   * Initialize default preferences for new user
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
    this.logger.log(`Initialized default preferences for user ${userId}`);
    
    return savedPreferences;
  }

  /**
   * Mute user for all notification types
   */
  async muteUser(userId: string, mutedUserId: string): Promise<void> {
    const preferences = await this.preferenceRepository.find({
      where: { userId },
    });

    for (const preference of preferences) {
      if (!preference.mutedUsers) {
        preference.mutedUsers = [];
      }
      
      if (!preference.mutedUsers.includes(mutedUserId)) {
        preference.mutedUsers.push(mutedUserId);
        await this.preferenceRepository.save(preference);
      }
    }

    this.logger.log(`User ${userId} muted user ${mutedUserId}`);
  }

  /**
   * Unmute user for all notification types
   */
  async unmuteUser(userId: string, mutedUserId: string): Promise<void> {
    const preferences = await this.preferenceRepository.find({
      where: { userId },
    });

    for (const preference of preferences) {
      if (preference.mutedUsers?.includes(mutedUserId)) {
        preference.mutedUsers = preference.mutedUsers.filter(id => id !== mutedUserId);
        await this.preferenceRepository.save(preference);
      }
    }

    this.logger.log(`User ${userId} unmuted user ${mutedUserId}`);
  }

  /**
   * Mute room for all notification types
   */
  async muteRoom(userId: string, roomId: string): Promise<void> {
    const preferences = await this.preferenceRepository.find({
      where: { userId },
    });

    for (const preference of preferences) {
      if (!preference.mutedRooms) {
        preference.mutedRooms = [];
      }
      
      if (!preference.mutedRooms.includes(roomId)) {
        preference.mutedRooms.push(roomId);
        await this.preferenceRepository.save(preference);
      }
    }

    this.logger.log(`User ${userId} muted room ${roomId}`);
  }

  /**
   * Unmute room for all notification types
   */
  async unmuteRoom(userId: string, roomId: string): Promise<void> {
    const preferences = await this.preferenceRepository.find({
      where: { userId },
    });

    for (const preference of preferences) {
      if (preference.mutedRooms?.includes(roomId)) {
        preference.mutedRooms = preference.mutedRooms.filter(id => id !== roomId);
        await this.preferenceRepository.save(preference);
      }
    }

    this.logger.log(`User ${userId} unmuted room ${roomId}`);
  }

  /**
   * Get muted users for a user
   */
  async getMutedUsers(userId: string): Promise<string[]> {
    const preferences = await this.preferenceRepository.find({
      where: { userId },
    });

    const mutedUsers = new Set<string>();
    for (const preference of preferences) {
      if (preference.mutedUsers) {
        preference.mutedUsers.forEach(id => mutedUsers.add(id));
      }
    }

    return Array.from(mutedUsers);
  }

  /**
   * Get muted rooms for a user
   */
  async getMutedRooms(userId: string): Promise<string[]> {
    const preferences = await this.preferenceRepository.find({
      where: { userId },
    });

    const mutedRooms = new Set<string>();
    for (const preference of preferences) {
      if (preference.mutedRooms) {
        preference.mutedRooms.forEach(id => mutedRooms.add(id));
      }
    }

    return Array.from(mutedRooms);
  }

  /**
   * Check if user is in quiet hours
   */
  async isInQuietHours(userId: string, type: NotificationType): Promise<boolean> {
    const preferences = await this.getPreferencesForType(userId, type);
    
    const now = new Date();
    const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;

    for (const preference of preferences) {
      if (preference.quietHoursStart && preference.quietHoursEnd) {
        if (currentTime >= preference.quietHoursStart && currentTime <= preference.quietHoursEnd) {
          return true;
        }
      }
    }

    return false;
  }

  /**
   * Get default preferences configuration
   */
  private getDefaultPreferences(): Partial<NotificationPreference>[] {
    const types = Object.values(NotificationType);
    const channels = Object.values(NotificationChannel);
    const defaults: Partial<NotificationPreference>[] = [];

    for (const type of types) {
      for (const channel of channels) {
        defaults.push({
          type,
          channel,
          isEnabled: this.getDefaultEnabledState(type, channel),
        });
      }
    }

    return defaults;
  }

  /**
   * Get default enabled state for notification type and channel
   */
  private getDefaultEnabledState(type: NotificationType, channel: NotificationChannel): boolean {
    // High priority notifications enabled by default
    const highPriorityTypes = [
      NotificationType.MENTION,
      NotificationType.REPLY,
      NotificationType.ROOM_INVITE,
    ];

    // In-app notifications enabled for all types
    if (channel === NotificationChannel.IN_APP) {
      return true;
    }

    // Push notifications enabled for high priority types
    if (channel === NotificationChannel.PUSH) {
      return highPriorityTypes.includes(type);
    }

    // Email notifications enabled for very high priority types only
    if (channel === NotificationChannel.EMAIL) {
      return [NotificationType.MENTION, NotificationType.ROOM_INVITE].includes(type);
    }

    // SMS disabled by default
    if (channel === NotificationChannel.SMS) {
      return false;
    }

    return true;
  }
}