import { Injectable, Logger } from '@nestjs/common';
import { LegalDocument } from './entities/legal-document.entity';

/**
 * Handles email notifications for legal document events.
 * Plugs into whatever email transport is configured (SMTP, SES, etc.).
 * Currently logs the notification — swap the TODO block for a real mailer.
 */
@Injectable()
export class LegalEmailService {
  private readonly logger = new Logger(LegalEmailService.name);

async notifyNewTermsPublished(
    document: LegalDocument,
    recipientEmails: string[],
  ): Promise<void> {
    if (!recipientEmails.length) {
      return;
    }

    this.logger.log(
      `Sending new-terms notification for ${document.type} v${document.version} to ${recipientEmails.length} users`,
    );

    // TODO: replace with real mailer (e.g. nodemailer / @nestjs-modules/mailer / SES)
    for (const email of recipientEmails) {
      this.logger.debug(
        `[EMAIL] To: ${email} | Subject: New ${document.type} published (v${document.version}) | ` +
          `Please review and accept the updated terms at your next login.`,
      );
    }
  }

  async sendBugReportEmail(
    to: string,
    title: string,
    description: string,
    appVersion: string,
    platform: string,
    reportId: string,
  ): Promise<void> {
    this.logger.log(`Sending high-priority bug alert: ${title} (${reportId})`);

    // TODO: real mailer
    this.logger.debug(
      `[EMAIL] To: ${to} | Subject: 🚨 HIGH PRIORITY BUG #${reportId} | ` +
        `${title} (${platform} ${appVersion}): ${description}`,
    );
  }
}
