import { ConfigService } from '@nestjs/config';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Test } from '@nestjs/testing';
import { Repository } from 'typeorm';
import { Webhook } from './entities/webhook.entity';
import { WebhookDelivery, WebhookDeliveryStatus } from './entities/webhook-delivery.entity';
import { WebhooksService } from './webhooks.service';

const mockQueueAdd = jest.fn();
const mockQueueClose = jest.fn();
const mockWorkerClose = jest.fn();

jest.mock('bullmq', () => ({
  Queue: jest.fn().mockImplementation(() => ({
    add: mockQueueAdd,
    close: mockQueueClose,
  })),
  Worker: jest.fn().mockImplementation((_name, processor) => ({
    processor,
    close: mockWorkerClose,
  })),
}));

describe('WebhooksService', () => {
  let service: WebhooksService;
  let webhookRepo: jest.Mocked<Repository<Webhook>>;
  let deliveryRepo: jest.Mocked<Repository<WebhookDelivery>>;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        WebhooksService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockImplementation((_k: string, d: unknown) => d),
          },
        },
        {
          provide: getRepositoryToken(Webhook),
          useValue: {
            create: jest.fn(),
            save: jest.fn(),
            find: jest.fn(),
            findOne: jest.fn(),
            remove: jest.fn(),
            delete: jest.fn(),
            createQueryBuilder: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(WebhookDelivery),
          useValue: {
            create: jest.fn(),
            save: jest.fn(),
            find: jest.fn(),
            findOne: jest.fn(),
            delete: jest.fn(),
          },
        },
      ],
    }).compile();

    service = moduleRef.get(WebhooksService);
    webhookRepo = moduleRef.get(getRepositoryToken(Webhook));
    deliveryRepo = moduleRef.get(getRepositoryToken(WebhookDelivery));

    mockQueueAdd.mockReset();
    mockQueueClose.mockReset();
    mockWorkerClose.mockReset();
  });

  it('creates webhook', async () => {
    webhookRepo.create.mockReturnValue({
      id: 'w1',
      userId: 'u1',
      url: 'https://example.com/webhook',
      secret: 'supersecret',
      events: ['event.a'],
      isActive: true,
      failureCount: 0,
      lastDeliveredAt: null,
      createdAt: new Date(),
    } as Webhook);
    webhookRepo.save.mockImplementation(async (v) => v as Webhook);

    const result = await service.createWebhook('u1', {
      url: 'https://example.com/webhook',
      secret: 'supersecret',
      events: ['event.a'],
    });

    expect(result.secret.endsWith('cret')).toBe(true);
    expect(result.secret.includes('super')).toBe(false);
  });

  it('updates webhook for owner', async () => {
    webhookRepo.findOne.mockResolvedValueOnce({
      id: 'w1',
      userId: 'u1',
      url: 'https://example.com',
      secret: 'secret',
      events: ['a'],
      isActive: true,
      failureCount: 0,
      lastDeliveredAt: null,
      createdAt: new Date(),
    } as Webhook);
    webhookRepo.save.mockImplementation(async (value) => value as Webhook);

    const result = await service.updateWebhook('u1', 'w1', { isActive: false });
    expect(result.isActive).toBe(false);
  });

  it('deletes webhook for owner', async () => {
    webhookRepo.findOne.mockResolvedValueOnce({
      id: 'w1',
      userId: 'u1',
    } as Webhook);
    webhookRepo.remove.mockResolvedValue({} as Webhook);

    await service.deleteWebhook('u1', 'w1');
    expect(webhookRepo.remove).toHaveBeenCalled();
  });

  it('throws on missing webhook in retryDelivery', async () => {
    deliveryRepo.findOne.mockResolvedValueOnce(null);
    await expect(service.retryDelivery('missing')).rejects.toThrow('Webhook delivery not found');
  });

  it('returns deliveries for owned webhook', async () => {
    webhookRepo.findOne.mockResolvedValueOnce({
      id: 'w1',
      userId: 'u1',
    } as Webhook);
    deliveryRepo.delete.mockResolvedValue({ affected: 0, raw: [] } as any);
    deliveryRepo.find.mockResolvedValue([{ id: 'd1' } as WebhookDelivery]);

    const result = await service.getDeliveries('u1', 'w1');
    expect(result).toHaveLength(1);
  });

  it('throws forbidden for webhook owned by another user', async () => {
    webhookRepo.findOne.mockResolvedValueOnce({
      id: 'w1',
      userId: 'other',
    } as Webhook);

    await expect(service.deleteWebhook('u1', 'w1')).rejects.toThrow(
      'Webhook does not belong to this user',
    );
  });

  it('masks webhook secret on get', async () => {
    webhookRepo.find.mockResolvedValue([
      {
        id: 'w1',
        userId: 'u1',
        url: 'https://example.com',
        secret: 'abcdef1234',
        events: ['x'],
        isActive: true,
        failureCount: 0,
        lastDeliveredAt: null,
        createdAt: new Date(),
      } as Webhook,
    ]);

    const result = await service.getWebhooks('u1');
    expect(result[0].secret).toBe('******1234');
  });

  it('queues deliveries for matching active webhooks', async () => {
    const getMany = jest.fn().mockResolvedValue([{ id: 'w1' }, { id: 'w2' }]);
    webhookRepo.createQueryBuilder.mockReturnValue({
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getMany,
    } as any);
    deliveryRepo.delete.mockResolvedValue({ affected: 0, raw: [] } as any);

    await service.deliverEvent('profile.updated', { userId: 'u1' });
    expect(mockQueueAdd).toHaveBeenCalledTimes(2);
  });

  it('retries failed delivery only', async () => {
    deliveryRepo.findOne.mockResolvedValueOnce({
      id: 'd1',
      webhookId: 'w1',
      eventType: 'x',
      payload: { ok: true },
      status: WebhookDeliveryStatus.FAILED,
    } as unknown as WebhookDelivery);

    await service.retryDelivery('d1');
    expect(mockQueueAdd).toHaveBeenCalledTimes(1);
  });

  it('does not retry successful delivery', async () => {
    deliveryRepo.findOne.mockResolvedValueOnce({
      id: 'd1',
      webhookId: 'w1',
      eventType: 'x',
      payload: { ok: true },
      status: WebhookDeliveryStatus.SUCCESS,
    } as unknown as WebhookDelivery);

    await service.retryDelivery('d1');
    expect(mockQueueAdd).not.toHaveBeenCalled();
  });

  it('auto-disables webhook after 10 consecutive failures', async () => {
    const webhook = {
      id: 'w1',
      userId: 'u1',
      url: 'https://example.com',
      secret: 'abc123',
      events: ['x'],
      isActive: true,
      failureCount: 9,
      lastDeliveredAt: null,
    } as Webhook;
    webhookRepo.findOne.mockResolvedValueOnce(webhook);
    deliveryRepo.create.mockReturnValue({
      webhookId: 'w1',
      eventType: 'x',
      payload: { a: 1 },
      status: WebhookDeliveryStatus.PENDING,
      responseCode: null,
    } as unknown as WebhookDelivery);
    deliveryRepo.save.mockImplementation(async (v) => v as WebhookDelivery);
    webhookRepo.save.mockImplementation(async (v) => v as Webhook);

    (global as any).fetch = jest.fn().mockResolvedValue({ ok: false, status: 500 });

    await (service as any).processDeliveryJob({
      data: { webhookId: 'w1', eventType: 'x', payload: { a: 1 } },
      id: 'j1',
    });

    expect(webhook.isActive).toBe(false);
    expect(webhook.failureCount).toBe(10);
  });

  it('resets failure count and sets lastDeliveredAt on success', async () => {
    const webhook = {
      id: 'w1',
      userId: 'u1',
      url: 'https://example.com',
      secret: 'abc123',
      events: ['x'],
      isActive: true,
      failureCount: 3,
      lastDeliveredAt: null,
    } as Webhook;
    webhookRepo.findOne.mockResolvedValueOnce(webhook);
    deliveryRepo.create.mockReturnValue({
      webhookId: 'w1',
      eventType: 'x',
      payload: { a: 1 },
      status: WebhookDeliveryStatus.PENDING,
      responseCode: null,
    } as unknown as WebhookDelivery);
    deliveryRepo.save.mockImplementation(async (v) => v as WebhookDelivery);
    webhookRepo.save.mockImplementation(async (v) => v as Webhook);

    (global as any).fetch = jest.fn().mockResolvedValue({ ok: true, status: 200 });
    await (service as any).processDeliveryJob({
      data: { webhookId: 'w1', eventType: 'x', payload: { a: 1 } },
      id: 'j2',
    });

    expect(webhook.failureCount).toBe(0);
    expect(webhook.lastDeliveredAt).toBeInstanceOf(Date);
  });

  it('throws and marks failed delivery when network error occurs', async () => {
    const webhook = {
      id: 'w1',
      userId: 'u1',
      url: 'https://example.com',
      secret: 'abc123',
      events: ['x'],
      isActive: true,
      failureCount: 0,
      lastDeliveredAt: null,
    } as Webhook;
    webhookRepo.findOne.mockResolvedValueOnce(webhook);
    deliveryRepo.create.mockReturnValue({
      webhookId: 'w1',
      eventType: 'x',
      payload: { a: 1 },
      status: WebhookDeliveryStatus.PENDING,
      responseCode: null,
    } as unknown as WebhookDelivery);
    deliveryRepo.save.mockImplementation(async (v) => v as WebhookDelivery);
    webhookRepo.save.mockImplementation(async (v) => v as Webhook);

    (global as any).fetch = jest.fn().mockRejectedValue(new Error('network down'));
    await expect(
      (service as any).processDeliveryJob({
        data: { webhookId: 'w1', eventType: 'x', payload: { a: 1 } },
        id: 'j3',
      }),
    ).rejects.toThrow('network down');
  });

  it('skips processing when webhook is missing or inactive', async () => {
    webhookRepo.findOne.mockResolvedValueOnce(null);
    await expect(
      (service as any).processDeliveryJob({
        data: { webhookId: 'none', eventType: 'x', payload: {} },
        id: 'j4',
      }),
    ).resolves.toBeUndefined();

    webhookRepo.findOne.mockResolvedValueOnce({ id: 'w1', isActive: false } as Webhook);
    await expect(
      (service as any).processDeliveryJob({
        data: { webhookId: 'w1', eventType: 'x', payload: {} },
        id: 'j5',
      }),
    ).resolves.toBeUndefined();
  });

  it('closes queue worker on module destroy', async () => {
    await service.onModuleDestroy();
    expect(mockWorkerClose).toHaveBeenCalled();
    expect(mockQueueClose).toHaveBeenCalled();
  });

  it('uses hmac sha256 signature', () => {
    const signature = (service as any).signPayload('{"a":1}', 'secret');
    expect(signature).toHaveLength(64);
  });
});
