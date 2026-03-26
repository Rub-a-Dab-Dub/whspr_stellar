import { Injectable } from '@nestjs/common';
import { TranslationService } from './translation.service';

export interface LocalizedEmailContent {
  locale: string;
  subject: string;
  body: string;
}

@Injectable()
export class EmailContentService {
  constructor(private readonly translationService: TranslationService) {}

  buildVerificationEmail(input: {
    preferredLocale?: string | null;
    verificationUrl: string;
  }): LocalizedEmailContent {
    const locale = this.translationService.resolveLocale(input.preferredLocale);

    return {
      locale,
      subject: this.translationService.translateForLocale(
        locale,
        'emails.auth.verifyEmail.subject',
      ),
      body: this.translationService.translateForLocale(
        locale,
        'emails.auth.verifyEmail.body',
        {
          verificationUrl: input.verificationUrl,
        },
      ),
    };
  }

  buildPasswordResetEmail(input: {
    preferredLocale?: string | null;
    resetUrl: string;
  }): LocalizedEmailContent {
    const locale = this.translationService.resolveLocale(input.preferredLocale);

    return {
      locale,
      subject: this.translationService.translateForLocale(
        locale,
        'emails.auth.resetPassword.subject',
      ),
      body: this.translationService.translateForLocale(
        locale,
        'emails.auth.resetPassword.body',
        {
          resetUrl: input.resetUrl,
        },
      ),
    };
  }
}
