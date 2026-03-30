import { EmailType } from '../enums/email-type.enum';

export interface SendEmailInput {
  deliveryId: string;
  to: string;
  subject: string;
  html: string;
  text?: string | null;
  type: EmailType;
  metadata?: Record<string, unknown>;
}

export interface SendEmailResult {
  messageId: string | null;
  deliveredAt?: Date | null;
}

export interface EmailProvider {
  send(input: SendEmailInput): Promise<SendEmailResult>;
}
