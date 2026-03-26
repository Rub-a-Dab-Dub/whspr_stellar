import { Injectable } from '@nestjs/common';
import { TranslationService } from './translation.service';

export interface LocalizedNotificationContent {
  locale: string;
  title: string;
  body: string;
}

@Injectable()
export class NotificationContentService {
  constructor(private readonly translationService: TranslationService) {}

  buildWalletLinkedNotification(input: {
    preferredLocale?: string | null;
    walletAddress: string;
    walletLabel?: string | null;
  }): LocalizedNotificationContent {
    const locale = this.translationService.resolveLocale(input.preferredLocale);
    const walletLabel = input.walletLabel || input.walletAddress;

    return {
      locale,
      title: this.translationService.translateForLocale(
        locale,
        'notifications.walletLinked.title',
      ),
      body: this.translationService.translateForLocale(
        locale,
        'notifications.walletLinked.body',
        {
          walletAddress: input.walletAddress,
          walletLabel,
        },
      ),
    };
  }

  buildNftAvatarUpdatedNotification(input: {
    preferredLocale?: string | null;
    nftName: string;
  }): LocalizedNotificationContent {
    const locale = this.translationService.resolveLocale(input.preferredLocale);

    return {
      locale,
      title: this.translationService.translateForLocale(
        locale,
        'notifications.nftAvatarUpdated.title',
      ),
      body: this.translationService.translateForLocale(
        locale,
        'notifications.nftAvatarUpdated.body',
        {
          nftName: input.nftName,
        },
      ),
    };
  }

  buildNftSyncNotification(input: {
    preferredLocale?: string | null;
    count: number;
  }): LocalizedNotificationContent {
    const locale = this.translationService.resolveLocale(input.preferredLocale);

    return {
      locale,
      title: this.translationService.translateForLocale(
        locale,
        'notifications.nftSyncComplete.title',
      ),
      body: this.translationService.translateForLocale(
        locale,
        'notifications.nftSyncComplete.body',
        {
          count: input.count,
        },
      ),
    };
  }
}
