import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  EmailProvider,
  SendEmailInput,
  SendEmailResult,
} from '../interfaces/email-provider.interface';

@Injectable()
export class HttpEmailProvider implements EmailProvider {
  constructor(private readonly configService: ConfigService) {}

  async send(input: SendEmailInput): Promise<SendEmailResult> {
    const provider = this.configService.get<string>('EMAIL_PROVIDER', 'sendgrid');
    const from = this.configService.get<string>('EMAIL_FROM_ADDRESS', 'noreply@example.com');

    if (provider === 'zeptomail') {
      return this.sendWithZeptoMail(input, from);
    }

    return this.sendWithSendGrid(input, from);
  }

  private async sendWithSendGrid(input: SendEmailInput, from: string): Promise<SendEmailResult> {
    const apiKey = this.configService.get<string>('SENDGRID_API_KEY', '');
    const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: { email: from },
        personalizations: [{ to: [{ email: input.to }] }],
        subject: input.subject,
        content: [
          { type: 'text/plain', value: input.text ?? '' },
          { type: 'text/html', value: input.html },
        ],
        custom_args: {
          deliveryId: input.deliveryId,
          type: input.type,
        },
      }),
    });

    if (!response.ok) {
      throw new Error(`SendGrid delivery failed with status ${response.status}`);
    }

    return {
      messageId: response.headers.get('x-message-id'),
      deliveredAt: new Date(),
    };
  }

  private async sendWithZeptoMail(input: SendEmailInput, from: string): Promise<SendEmailResult> {
    const apiKey = this.configService.get<string>('ZEPTOMAIL_API_KEY', '');
    const endpoint = this.configService.get<string>(
      'ZEPTOMAIL_API_URL',
      'https://api.zeptomail.com/v1.1/email',
    );

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        Authorization: `Zoho-enczapikey ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: { address: from },
        to: [{ email_address: { address: input.to } }],
        subject: input.subject,
        htmlbody: input.html,
        textbody: input.text ?? '',
      }),
    });

    if (!response.ok) {
      throw new Error(`ZeptoMail delivery failed with status ${response.status}`);
    }

    return {
      messageId: response.headers.get('x-message-id'),
      deliveredAt: new Date(),
    };
  }
}
