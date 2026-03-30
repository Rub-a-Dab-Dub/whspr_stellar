import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { EmailDeliveriesRepository, EmailUnsubscribesRepository } from './email.repository';
import { EmailQueueService } from './email-queue.service';
import { EmailService } from './email.service';
import { EmailTemplateService } from './email-template.service';
import { EmailDeliveryStatus, EmailType } from './enums/email-type.enum';
import { EMAIL_PROVIDER_TOKEN } from './constants';

describe('EmailService', () => {
  let service: EmailService;
  let deliveriesRepository: jest.Mocked<EmailDeliveriesRepository>;
  let unsubscribesRepository: jest.Mocked<EmailUnsubscribesRepository>;
  let queueService: jest.Mocked<EmailQueueService>;
  let provider: { send: jest.Mock };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EmailService,
        EmailTemplateService,
        {
          provide: EmailDeliveriesRepository,
          useValue: {
            create: jest.fn((value) => value),
            save: jest.fn(async (value) => ({
              id: value.id ?? 'delivery-1',
              createdAt: value.createdAt ?? new Date('2026-01-01T00:00:00.000Z'),
              updatedAt: new Date('2026-01-01T00:00:00.000Z'),
              ...value,
            })),
            findOne: jest.fn(),
          },
        },
        {
          provide: EmailUnsubscribesRepository,
          useValue: {
            create: jest.fn((value) => value),
            save: jest.fn(async (value) => value),
            findByEmail: jest.fn(),
          },
        },
        {
          provide: EmailQueueService,
          useValue: {
            enqueue: jest.fn().mockResolvedValue(undefined),
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string, fallback?: string) => {
              if (key === 'APP_PUBLIC_URL') {
                return 'https://app.whspr.example';
              }
              return fallback;
            }),
          },
        },
        {
          provide: EMAIL_PROVIDER_TOKEN,
          useValue: {
            send: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get(EmailService);
    deliveriesRepository = module.get(EmailDeliveriesRepository);
    unsubscribesRepository = module.get(EmailUnsubscribesRepository);
    queueService = module.get(EmailQueueService);
    provider = module.get(EMAIL_PROVIDER_TOKEN);
  });

  it('queues a welcome email with rendered HTML', async () => {
    unsubscribesRepository.findByEmail.mockResolvedValue(null);

    const delivery = await service.sendWelcome({
      to: 'user@example.com',
      displayName: 'Ada',
    });

    expect(delivery.type).toBe(EmailType.WELCOME);
    expect(delivery.status).toBe(EmailDeliveryStatus.QUEUED);
    expect(delivery.html).toContain('Welcome, Ada');
    expect(queueService.enqueue).toHaveBeenCalledWith({ deliveryId: 'delivery-1' });
  });

  it('suppresses unsubscribe-respecting emails', async () => {
    unsubscribesRepository.findByEmail.mockResolvedValue({
      id: 'unsub-1',
      email: 'user@example.com',
      reason: null,
      createdAt: new Date(),
    });

    const delivery = await service.sendGroupInvite({
      to: 'user@example.com',
      inviterName: 'Grace',
      groupName: 'Builders',
      inviteUrl: 'https://example.com/invite',
    });

    expect(delivery.status).toBe(EmailDeliveryStatus.FAILED);
    expect(queueService.enqueue).not.toHaveBeenCalled();
  });

  it('processes queued deliveries with a mocked provider', async () => {
    deliveriesRepository.findOne.mockResolvedValue({
      id: 'delivery-1',
      type: EmailType.SECURITY_ALERT,
      to: 'user@example.com',
      subject: 'Security alert',
      html: '<p>Alert</p>',
      text: 'Alert',
      status: EmailDeliveryStatus.QUEUED,
      providerMessageId: null,
      metadata: {},
      failureReason: null,
      attempts: 0,
      sentAt: null,
      deliveredAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    provider.send.mockResolvedValue({
      messageId: 'provider-1',
      deliveredAt: new Date('2026-01-01T00:00:00.000Z'),
    });

    const result = await service.processDelivery('delivery-1');

    expect(result.status).toBe(EmailDeliveryStatus.DELIVERED);
    expect(result.providerMessageId).toBe('provider-1');
  });

  it('renders generic handlebars-style templates', async () => {
    unsubscribesRepository.findByEmail.mockResolvedValue(null);

    const delivery = await service.sendGeneric({
      to: 'user@example.com',
      subject: 'Update',
      heading: 'Hello',
      body: 'A generic message',
    });

    expect(delivery.subject).toBe('Update');
    expect(delivery.html).toContain('Hello');
    expect(delivery.text).toContain('A generic message');
  });
});
