import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EMAIL_PROVIDER_TOKEN } from './constants';
import { EmailDeliveriesRepository, EmailUnsubscribesRepository } from './email.repository';
import { EmailQueueService } from './email-queue.service';
import { EmailTemplateService } from './email-template.service';
import { EmailDeliveryStatus, EmailType } from './enums/email-type.enum';
import { EmailDelivery } from './entities/email-delivery.entity';
import { EmailProvider } from './interfaces/email-provider.interface';

interface QueueEmailOptions {
  type: EmailType;
  to: string;
  variables: Record<string, string | number | null | undefined>;
  metadata?: Record<string, unknown>;
  respectUnsubscribe?: boolean;
}

@Injectable()
export class EmailService {
  constructor(
    private readonly deliveriesRepository: EmailDeliveriesRepository,
    private readonly unsubscribesRepository: EmailUnsubscribesRepository,
    private readonly templateService: EmailTemplateService,
    private readonly queueService: EmailQueueService,
    private readonly configService: ConfigService,
    @Inject(EMAIL_PROVIDER_TOKEN)
    private readonly provider: EmailProvider,
  ) {}

  sendWelcome(input: { to: string; displayName?: string | null }): Promise<EmailDelivery> {
    return this.queueTemplatedEmail({
      type: EmailType.WELCOME,
      to: input.to,
      variables: {
        displayName: input.displayName ?? 'there',
        appUrl: this.configService.get<string>('APP_PUBLIC_URL', 'https://app.whspr.example'),
        unsubscribeLink: this.unsubscribeHtml(input.to),
        unsubscribeText: this.unsubscribeText(input.to),
      },
      respectUnsubscribe: true,
    });
  }

  sendVerification(input: {
    to: string;
    displayName?: string | null;
    verificationUrl: string;
  }): Promise<EmailDelivery> {
    return this.queueTemplatedEmail({
      type: EmailType.VERIFICATION,
      to: input.to,
      variables: {
        displayName: input.displayName ?? 'there',
        verificationUrl: input.verificationUrl,
      },
      respectUnsubscribe: false,
    });
  }

  sendTransactionReceipt(input: {
    to: string;
    displayName?: string | null;
    amount: string;
    asset: string;
    reference: string;
  }): Promise<EmailDelivery> {
    return this.queueTemplatedEmail({
      type: EmailType.TRANSACTION_RECEIPT,
      to: input.to,
      variables: {
        displayName: input.displayName ?? 'there',
        amount: input.amount,
        asset: input.asset,
        reference: input.reference,
      },
      metadata: { reference: input.reference },
      respectUnsubscribe: false,
    });
  }

  sendGroupInvite(input: {
    to: string;
    inviterName: string;
    groupName: string;
    inviteUrl: string;
  }): Promise<EmailDelivery> {
    return this.queueTemplatedEmail({
      type: EmailType.GROUP_INVITE,
      to: input.to,
      variables: {
        inviterName: input.inviterName,
        groupName: input.groupName,
        inviteUrl: input.inviteUrl,
        unsubscribeLink: this.unsubscribeHtml(input.to),
        unsubscribeText: this.unsubscribeText(input.to),
      },
      respectUnsubscribe: true,
    });
  }

  sendSecurityAlert(input: {
    to: string;
    displayName?: string | null;
    message: string;
    actionUrl: string;
  }): Promise<EmailDelivery> {
    return this.queueTemplatedEmail({
      type: EmailType.SECURITY_ALERT,
      to: input.to,
      variables: {
        displayName: input.displayName ?? 'there',
        message: input.message,
        actionUrl: input.actionUrl,
      },
      metadata: { actionUrl: input.actionUrl },
      respectUnsubscribe: false,
    });
  }

  sendGeneric(input: {
    to: string;
    subject: string;
    heading: string;
    body: string;
    respectUnsubscribe?: boolean;
  }): Promise<EmailDelivery> {
    return this.queueTemplatedEmail({
      type: EmailType.GENERIC,
      to: input.to,
      variables: {
        subject: input.subject,
        heading: input.heading,
        body: input.body,
        unsubscribeLink: this.unsubscribeHtml(input.to),
        unsubscribeText: this.unsubscribeText(input.to),
      },
      respectUnsubscribe: input.respectUnsubscribe ?? true,
    });
  }

  async unsubscribe(email: string, reason?: string): Promise<void> {
    const normalized = email.toLowerCase();
    const existing = await this.unsubscribesRepository.findByEmail(normalized);
    if (existing) {
      return;
    }

    await this.unsubscribesRepository.save(
      this.unsubscribesRepository.create({ email: normalized, reason: reason ?? null }),
    );
  }

  async processDelivery(deliveryId: string): Promise<EmailDelivery> {
    const delivery = await this.deliveriesRepository.findOne({ where: { id: deliveryId } });
    if (!delivery) {
      throw new NotFoundException(`Email delivery ${deliveryId} not found`);
    }

    try {
      const result = await this.provider.send({
        deliveryId: delivery.id,
        to: delivery.to,
        subject: delivery.subject,
        html: delivery.html,
        text: delivery.text,
        type: delivery.type,
        metadata: delivery.metadata,
      });

      delivery.status = result.deliveredAt
        ? EmailDeliveryStatus.DELIVERED
        : EmailDeliveryStatus.SENT;
      delivery.providerMessageId = result.messageId;
      delivery.sentAt = new Date();
      delivery.deliveredAt = result.deliveredAt ?? null;
      delivery.failureReason = null;
      delivery.attempts += 1;
    } catch (error) {
      delivery.status = EmailDeliveryStatus.FAILED;
      delivery.failureReason = error instanceof Error ? error.message : 'Unknown email failure';
      delivery.attempts += 1;
      await this.deliveriesRepository.save(delivery);
      throw error;
    }

    return this.deliveriesRepository.save(delivery);
  }

  private async queueTemplatedEmail(options: QueueEmailOptions): Promise<EmailDelivery> {
    if (options.respectUnsubscribe && (await this.isUnsubscribed(options.to))) {
      return this.deliveriesRepository.save(
        this.deliveriesRepository.create({
          type: options.type,
          to: options.to.toLowerCase(),
          subject: `Suppressed ${options.type} email`,
          html: '',
          text: '',
          status: EmailDeliveryStatus.FAILED,
          failureReason: 'Recipient has unsubscribed from email delivery',
          metadata: options.metadata ?? {},
          providerMessageId: null,
          attempts: 0,
          sentAt: null,
          deliveredAt: null,
        }),
      );
    }

    const rendered = this.templateService.render(options.type, options.variables);
    const delivery = await this.deliveriesRepository.save(
      this.deliveriesRepository.create({
        type: options.type,
        to: options.to.toLowerCase(),
        subject: rendered.subject,
        html: rendered.html,
        text: rendered.text,
        status: EmailDeliveryStatus.QUEUED,
        metadata: options.metadata ?? {},
        providerMessageId: null,
        failureReason: null,
        attempts: 0,
        sentAt: null,
        deliveredAt: null,
      }),
    );

    await this.queueService.enqueue({ deliveryId: delivery.id });
    return delivery;
  }

  private async isUnsubscribed(email: string): Promise<boolean> {
    return !!(await this.unsubscribesRepository.findByEmail(email.toLowerCase()));
  }

  private unsubscribeHtml(email: string): string {
    const baseUrl = this.configService.get<string>('APP_PUBLIC_URL', 'https://app.whspr.example');
    return `<p><a href="${baseUrl}/unsubscribe?email=${encodeURIComponent(email)}">Unsubscribe</a></p>`;
  }

  private unsubscribeText(email: string): string {
    const baseUrl = this.configService.get<string>('APP_PUBLIC_URL', 'https://app.whspr.example');
    return `Unsubscribe: ${baseUrl}/unsubscribe?email=${encodeURIComponent(email)}`;
  }
}
