import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private transporter: nodemailer.Transporter;

  constructor(private readonly config: ConfigService) {
    this.transporter = nodemailer.createTransport({
      host: this.config.get('MAIL_HOST', 'smtp.ethereal.email'),
      port: this.config.get<number>('MAIL_PORT', 587),
      secure: false,
      auth: {
        user: this.config.get('MAIL_USER', ''),
        pass: this.config.get('MAIL_PASS', ''),
      },
    });
  }

  async sendWaitlistConfirmation(
    email: string,
    referralCode: string,
    position: number,
  ): Promise<void> {
    try {
      await this.transporter.sendMail({
        from: `"Gasless Gossip" <${this.config.get('MAIL_FROM', 'noreply@gaslessgossip.com')}>`,
        to: email,
        subject: "You're on the Gasless Gossip waitlist! 🦜",
        html: `
          <h2>Welcome to Gasless Gossip!</h2>
          <p>You joined at position <strong>#${position}</strong>.</p>
          <p>Your referral code: <strong>${referralCode}</strong></p>
          <p>Share it to earn <strong>25 points per referral</strong> and climb the leaderboard.</p>
          <p>Top users get early access. Good luck!</p>
        `,
      });
    } catch (err) {
      // Log but don't crash the signup flow if email fails
      this.logger.error(`Failed to send confirmation to ${email}`, err);
    }
  }

  /**
   * Sends a grouped notification digest email summary.
   */
  async sendDigestEmail(
    email: string,
    grouped: Record<string, unknown[]>,
    totalCount: number,
  ): Promise<void> {
    try {
      const rows = Object.entries(grouped)
        .map(
          ([type, items]) =>
            `<tr><td style="padding:4px 8px">${type.replace(/_/g, ' ')}</td>` +
            `<td style="padding:4px 8px;text-align:center"><strong>${items.length}</strong></td></tr>`,
        )
        .join('');

      await this.transporter.sendMail({
        from: `"Gasless Gossip" <${this.config.get('MAIL_FROM', 'noreply@gaslessgossip.com')}>`,
        to: email,
        subject: `📋 Your notification digest – ${totalCount} missed notification${totalCount === 1 ? '' : 's'}`,
        html: `
          <h2>Here's what you missed 📋</h2>
          <p>You had <strong>${totalCount}</strong> notification${totalCount === 1 ? '' : 's'} during your quiet hours.</p>
          <table border="0" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin-top:16px">
            <thead>
              <tr style="background:#f3f4f6">
                <th style="padding:8px;text-align:left">Type</th>
                <th style="padding:8px;text-align:center">Count</th>
              </tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>
          <p style="margin-top:16px;color:#6b7280;font-size:12px">
            Open the app to view your notifications in full.
          </p>
        `,
      });
    } catch (err) {
      this.logger.error(`Failed to send digest email to ${email}`, err);
    }
  }

  async sendPlatformInviteEmail(to: string, inviteCode: string): Promise<void> {
    try {
      await this.transporter.sendMail({
        from: `"Gasless Gossip" <${this.config.get('MAIL_FROM', 'noreply@gaslessgossip.com')}>`,
        to,
        subject: 'Your Gasless Gossip platform invite',
        html: `
          <h2>You’re invited</h2>
          <p>Use this invite code when you register:</p>
          <p style="font-size:18px;font-family:monospace;letter-spacing:2px"><strong>${inviteCode}</strong></p>
          <p style="color:#6b7280;font-size:12px">Keep this code private. It may be single-use or limited-use depending on how it was issued.</p>
        `,
      });
    } catch (err) {
      this.logger.error(`Failed to send platform invite email to ${to}`, err);
      throw err;
    }
  }
}