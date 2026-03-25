import {
  Injectable,
  Logger,
  NotFoundException,
  ForbiddenException,
  OnModuleDestroy,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { createHmac } from 'crypto';
import { Queue, Worker, Job } from 'bullmq';
import { Webhook } from './entities/webhook.entity';
import { WebhookDelivery, WebhookDeliveryStatus } from './entities/webhook-delivery.entity';
import { CreateWebhookDto } from './dto/create-webhook.dto';
import { UpdateWebhookDto } from './dto/update-webhook.dto';
import { WebhookResponseDto } from './dto/webhook-response.dto';

type DeliveryJobData = {
  webhookId: string;
  eventType: string;
  payload: Record<string, unknown>;
};

const WEBHOOK_QUEUE_NAME = 'webhook-deliveries';
const MAX_FAILURES_BEFORE_DISABLE = 10;
const DELIVERY_RETENTION_DAYS = 30;

@Injectable()
export class WebhooksService implements OnModuleDestroy {
  private readonly logger = new Logger(WebhooksService.name);
  private readonly queue: Queue<DeliveryJobData>;
  private readonly worker: Worker<DeliveryJobData>;

  constructor(
    @InjectRepository(Webhook)
    private readonly webhookRepository: Repository<Webhook>,
    @InjectRepository(WebhookDelivery)
    private readonly deliveryRepository: Repository<WebhookDelivery>,
    configService: ConfigService,
  ) {
    const connection = {
      host: configService.get<string>('REDIS_HOST', 'localhost'),
      port: configService.get<number>('REDIS_PORT', 6379),
      password: configService.get<string>('REDIS_PASSWORD') || undefined,
      db: configService.get<number>('REDIS_DB', 0),
      maxRetriesPerRequest: null as number | null,
    };

    this.queue = new Queue<DeliveryJobData>(WEBHOOK_QUEUE_NAME, {
      connection,
      defaultJobOptions: {
        attempts: 5,
        backoff: { type: 'exponential', delay: 1000 },
        removeOnComplete: 1000,
        removeOnFail: 1000,
      },
    });

    this.worker = new Worker<DeliveryJobData>(
      WEBHOOK_QUEUE_NAME,
      async (job) => this.processDeliveryJob(job),
      { connection },
    );
  }

  async createWebhook(userId: string, dto: CreateWebhookDto): Promise<WebhookResponseDto> {
    const webhook = this.webhookRepository.create({
      userId,
      url: dto.url,
      secret: dto.secret,
      events: dto.events,
      isActive: dto.isActive ?? true,
      failureCount: 0,
      lastDeliveredAt: null,
    });
    const saved = await this.webhookRepository.save(webhook);
    return this.toWebhookResponse(saved);
  }

  async getWebhooks(userId: string): Promise<WebhookResponseDto[]> {
    const webhooks = await this.webhookRepository.find({
      where: { userId },
      order: { createdAt: 'DESC' },
    });
    return webhooks.map((webhook) => this.toWebhookResponse(webhook));
  }

  async updateWebhook(
    userId: string,
    webhookId: string,
    dto: UpdateWebhookDto,
  ): Promise<WebhookResponseDto> {
    const webhook = await this.getOwnedWebhook(userId, webhookId);
    Object.assign(webhook, dto);
    const saved = await this.webhookRepository.save(webhook);
    return this.toWebhookResponse(saved);
  }

  async deleteWebhook(userId: string, webhookId: string): Promise<void> {
    const webhook = await this.getOwnedWebhook(userId, webhookId);
    await this.webhookRepository.remove(webhook);
  }

  async getDeliveries(userId: string, webhookId: string): Promise<WebhookDelivery[]> {
    await this.cleanupOldDeliveries();
    await this.getOwnedWebhook(userId, webhookId);
    return this.deliveryRepository.find({
      where: { webhookId },
      order: { deliveredAt: 'DESC' },
    });
  }

  async deliverEvent(eventType: string, payload: Record<string, unknown>): Promise<void> {
    await this.cleanupOldDeliveries();
    const targets = await this.webhookRepository
      .createQueryBuilder('webhook')
      .where('webhook.isActive = :isActive', { isActive: true })
      .andWhere(':eventType = ANY(webhook.events)', { eventType })
      .getMany();

    await Promise.all(
      targets.map((webhook) =>
        this.queue.add('deliver', {
          webhookId: webhook.id,
          eventType,
          payload,
        }),
      ),
    );
  }

  async retryDelivery(deliveryId: string): Promise<void> {
    const delivery = await this.deliveryRepository.findOne({ where: { id: deliveryId } });
    if (!delivery) {
      throw new NotFoundException('Webhook delivery not found');
    }

    if (delivery.status !== WebhookDeliveryStatus.FAILED) {
      return;
    }

    await this.queue.add('retry-delivery', {
      webhookId: delivery.webhookId,
      eventType: delivery.eventType,
      payload: delivery.payload,
    });
  }

  async onModuleDestroy(): Promise<void> {
    await this.worker.close();
    await this.queue.close();
  }

  private async processDeliveryJob(job: Job<DeliveryJobData>): Promise<void> {
    const { webhookId, eventType, payload } = job.data;
    const webhook = await this.webhookRepository.findOne({ where: { id: webhookId } });
    if (!webhook || !webhook.isActive) {
      return;
    }

    const delivery = this.deliveryRepository.create({
      webhookId,
      eventType,
      payload,
      status: WebhookDeliveryStatus.PENDING,
      responseCode: null,
    });
    await this.deliveryRepository.save(delivery);

    const body = JSON.stringify(payload);
    const signature = this.signPayload(body, webhook.secret);

    try {
      const response = await fetch(webhook.url, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-gasless-gossip-event': eventType,
          'x-gasless-gossip-signature': signature,
        },
        body,
      });

      delivery.status = response.ok ? WebhookDeliveryStatus.SUCCESS : WebhookDeliveryStatus.FAILED;
      delivery.responseCode = response.status;
      await this.deliveryRepository.save(delivery);

      if (response.ok) {
        webhook.failureCount = 0;
        webhook.lastDeliveredAt = new Date();
      } else {
        webhook.failureCount += 1;
      }
    } catch (error) {
      delivery.status = WebhookDeliveryStatus.FAILED;
      delivery.responseCode = null;
      await this.deliveryRepository.save(delivery);
      webhook.failureCount += 1;

      this.logger.error(
        `Webhook delivery failed for webhookId=${webhook.id} eventType=${eventType} jobId=${job.id}`,
        error instanceof Error ? error.stack : undefined,
      );
      throw error;
    } finally {
      if (webhook.failureCount >= MAX_FAILURES_BEFORE_DISABLE) {
        webhook.isActive = false;
      }
      await this.webhookRepository.save(webhook);
    }
  }

  private signPayload(payload: string, secret: string): string {
    return createHmac('sha256', secret).update(payload).digest('hex');
  }

  private maskSecret(secret: string): string {
    if (secret.length <= 4) {
      return '*'.repeat(secret.length);
    }
    return `${'*'.repeat(secret.length - 4)}${secret.slice(-4)}`;
  }

  private toWebhookResponse(webhook: Webhook): WebhookResponseDto {
    return {
      id: webhook.id,
      userId: webhook.userId,
      url: webhook.url,
      secret: this.maskSecret(webhook.secret),
      events: webhook.events,
      isActive: webhook.isActive,
      lastDeliveredAt: webhook.lastDeliveredAt,
      failureCount: webhook.failureCount,
      createdAt: webhook.createdAt,
    };
  }

  private async getOwnedWebhook(userId: string, webhookId: string): Promise<Webhook> {
    const webhook = await this.webhookRepository.findOne({ where: { id: webhookId } });
    if (!webhook) {
      throw new NotFoundException('Webhook not found');
    }
    if (webhook.userId !== userId) {
      throw new ForbiddenException('Webhook does not belong to this user');
    }
    return webhook;
  }

  private async cleanupOldDeliveries(): Promise<void> {
    const cutoff = new Date(Date.now() - DELIVERY_RETENTION_DAYS * 24 * 60 * 60 * 1000);
    await this.deliveryRepository.delete({ deliveredAt: LessThan(cutoff) });
  }
}
