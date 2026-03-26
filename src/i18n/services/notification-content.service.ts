import { Injectable } from '@nestjs/common';
import { TranslationService } from './translation.service';

export interface LocalizedNotificationContent {
  locale: string;
  title: string;
  message: string;
}

@Injectable()
export class NotificationContentService {
  constructor(private readonly translationService: TranslationService) {}

  buildRoomInvitationNotification(input: {
    preferredLocale?: string | null;
    roomName: string;
  }): LocalizedNotificationContent {
    const locale = this.translationService.resolveLocale(input.preferredLocale);

    return {
      locale,
      title: this.translationService.translateForLocale(
        locale,
        'notifications.roomInvitation.title',
      ),
      message: this.translationService.translateForLocale(
        locale,
        'notifications.roomInvitation.message',
        { roomName: input.roomName },
      ),
    };
  }

  buildRewardGrantedNotification(input: {
    preferredLocale?: string | null;
    rewardName: string;
  }): LocalizedNotificationContent {
    const locale = this.translationService.resolveLocale(input.preferredLocale);

    return {
      locale,
      title: this.translationService.translateForLocale(
        locale,
        'notifications.rewardGranted.title',
      ),
      message: this.translationService.translateForLocale(
        locale,
        'notifications.rewardGranted.message',
        { rewardName: input.rewardName },
      ),
    };
  }

  buildLevelUpNotification(input: {
    preferredLocale?: string | null;
    newLevel: number;
  }): LocalizedNotificationContent {
    const locale = this.translationService.resolveLocale(input.preferredLocale);

    return {
      locale,
      title: this.translationService.translateForLocale(
        locale,
        'notifications.levelUp.title',
      ),
      message: this.translationService.translateForLocale(
        locale,
        'notifications.levelUp.message',
        { newLevel: input.newLevel },
      ),
    };
  }

  buildAchievementNotification(input: {
    preferredLocale?: string | null;
    achievementName: string;
  }): LocalizedNotificationContent {
    const locale = this.translationService.resolveLocale(input.preferredLocale);

    return {
      locale,
      title: this.translationService.translateForLocale(
        locale,
        'notifications.achievement.title',
      ),
      message: this.translationService.translateForLocale(
        locale,
        'notifications.achievement.message',
        { achievementName: input.achievementName },
      ),
    };
  }
}
