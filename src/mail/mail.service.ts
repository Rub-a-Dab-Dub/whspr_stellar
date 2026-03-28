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
}