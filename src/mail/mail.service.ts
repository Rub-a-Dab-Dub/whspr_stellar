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


  async sendSecurityAlert(
  email: string,
  details: {
    ipAddress: string;
    country: string;
    city: string;
    riskScore: number;
    reasons: string[];
    action: string;
    timestamp: Date;
  },
): Promise<void> {
  try {
    await this.transporter.sendMail({
      from: `"Gasless Gossip Security" <${this.config.get('MAIL_FROM', 'security@gaslessgossip.com')}>`,
      to: email,
      subject: '⚠️ Suspicious login detected on your account',
      html: `
        <h2>Security Alert</h2>
        <p>We detected a suspicious login attempt on your account.</p>
        <table>
          <tr><td><strong>IP Address</strong></td><td>${details.ipAddress}</td></tr>
          <tr><td><strong>Location</strong></td><td>${details.city}, ${details.country}</td></tr>
          <tr><td><strong>Risk Score</strong></td><td>${details.riskScore}/100</td></tr>
          <tr><td><strong>Action Taken</strong></td><td>${details.action}</td></tr>
          <tr><td><strong>Time</strong></td><td>${details.timestamp.toISOString()}</td></tr>
        </table>
        <p><strong>Reasons flagged:</strong></p>
        <ul>${details.reasons.map((r) => `<li>${r}</li>`).join('')}</ul>
        <p>If this was you, you can ignore this message. If not, please change your password immediately.</p>
      `,
    });
  } catch (err) {
    this.logger.error(`Failed to send security alert to ${email}`, err);
  }
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