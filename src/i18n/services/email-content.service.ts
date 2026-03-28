import { Injectable } from '@nestjs/common';
import { TranslationService } from './translation.service';

export interface LocalizedEmailContent {
  locale: string;
  subject: string;
  preview: string;
  body: string;
}

@Injectable()
export class EmailContentService {
  constructor(private readonly translationService: TranslationService) {}

  buildWelcomeEmail(input: {
    preferredLocale?: string | null;
    displayName?: string | null;
  }): LocalizedEmailContent {
    const locale = this.translationService.resolveLocale(input.preferredLocale);

    return {
      locale,
      subject: this.translationService.translateForLocale(locale, 'emails.welcome.subject'),
      preview: this.translationService.translateForLocale(locale, 'emails.welcome.preview'),
      body: this.translationService.translateForLocale(locale, 'emails.welcome.body', {
        displayName: input.displayName || 'there',
      }),
    };
  }

  buildWalletLinkedEmail(input: {
    preferredLocale?: string | null;
    walletAddress: string;
  }): LocalizedEmailContent {
    const locale = this.translationService.resolveLocale(input.preferredLocale);

    return {
      locale,
      subject: this.translationService.translateForLocale(
        locale,
        'emails.walletLinked.subject',
      ),
      preview: this.translationService.translateForLocale(
        locale,
        'emails.walletLinked.preview',
      ),
      body: this.translationService.translateForLocale(
        locale,
        'emails.walletLinked.body',
        {
          walletAddress: input.walletAddress,
        },
      ),
    };
  }
}
