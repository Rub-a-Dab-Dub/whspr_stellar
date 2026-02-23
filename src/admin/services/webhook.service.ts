import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { InjectQueue } from '@nestjs/bull';
import { Repository, Between, MoreThanOrEqual, LessThanOrEqual } from 'typeorm';
import { Queue } from 'bull';
import { createHmac, randomBytes } from 'crypto';
import type { Request } from 'express';

import {
  WebhookSubscription,
} from '../entities/webhook-subscription.entity';
import {
  WebhookDelivery,
  WebhookDeliveryStatus,
} from '../entities/webhook-delivery.entity';
import { User } from '../../user/entities/user.entity';
import { Notification } from '../../notifications/entities/notification.entity';
import { CreateWebhookDto } from '../dto/webhook/create-webhook.dto';
import { UpdateWebhookDto } from '../dto/webhook/update-webhook.dto';
import { GetWebhookDeliveriesDto } from '../dto/webhook/get-webhook-deliveries.dto';
import { AuditLogService } from './audit-log.service';
import {
  AuditAction,
  AuditEventType,
  AuditOutcome,
  AuditSeverity,
} from '../entities/audit-log.entity';
import { QUEUE_NAMES } from '../../queue/queue.constants';
import { UserRole } from '../../roles/entities/user-role.enum';
import {
  NotificationType,
  NotificationPriority,
} from '../../notifications/enums/notification-type.enum';

const MAX_CONSECUTIVE_FAILURES = 5;
const WEBHOOK_JOB_NAME = 'deliver-webhook';

@Injectable()
export class WebhookService {
  private readonly logger = new Logger(WebhookService.name);

  constructor(
    @InjectRepository(WebhookSubscription)
    private readonly subscriptionRepository: Repository<WebhookSubscription>,
    @InjectRepository(WebhookDelivery)
    private readonly deliveryRepository: Repository<WebhookDelivery>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(Notification)
    private readonly notificationRepository: Repository<Notification>,
    @InjectQueue(QUEUE_NAMES.WEBHOOK_DELIVERIES)
    private readonly webhookQueue: Queue,
    private readonly auditLogService: AuditLogService,
  ) {}

  // ─── Public API ─────────────────────────────────────────────────────────────

  async findAll(): Promise<WebhookSubscription[]> {
    return this.subscriptionRepository.find({
      order: { createdAt: 'DESC' },
    });
  }

  async create(
    dto: CreateWebhookDto,
    adminId: string,
    req?: Request,
  ): Promise<WebhookSubscription & { plainSecret: string }> {
    const plainSecret = randomBytes(32).toString('hex');

    const subscription = this.subscriptionRepository.create({
      url: dto.url,
      secret: plainSecret,
      events: dto.events,
      description: dto.description ?? null,
      isActive: true,
      consecutiveFailures: 0,
      createdById: adminId,
    });

    const saved = await this.subscriptionRepository.save(subscription);

    await this.auditLogService.createAuditLog({
      eventType: AuditEventType.ADMIN,
      action: AuditAction.WEBHOOK_CREATED,
      actorUserId: adminId,
      outcome: AuditOutcome.SUCCESS,
      severity: AuditSeverity.MEDIUM,
      resourceType: 'WebhookSubscription',
      resourceId: saved.id,
      details: `Created webhook subscription for ${dto.url}`,
      metadata: { url: dto.url, events: dto.events },
      req,
    });

    return { ...saved, plainSecret };
  }

  async update(
    id: string,
    dto: UpdateWebhookDto,
    adminId: string,
    req?: Request,
  ): Promise<WebhookSubscription> {
    const subscription = await this.findOneOrFail(id);

    if (dto.url !== undefined) subscription.url = dto.url;
    if (dto.events !== undefined) subscription.events = dto.events;
    if (dto.description !== undefined) subscription.description = dto.description;
    if (dto.isActive !== undefined) subscription.isActive = dto.isActive;

    const saved = await this.subscriptionRepository.save(subscription);

    await this.auditLogService.createAuditLog({
      eventType: AuditEventType.ADMIN,
      action: AuditAction.WEBHOOK_UPDATED,
      actorUserId: adminId,
      outcome: AuditOutcome.SUCCESS,
      severity: AuditSeverity.MEDIUM,
      resourceType: 'WebhookSubscription',
      resourceId: id,
      details: `Updated webhook subscription ${id}`,
      metadata: { changes: dto },
      req,
    });

    return saved;
  }

  async remove(id: string, adminId: string, req?: Request): Promise<void> {
    const subscription = await this.findOneOrFail(id);
    await this.subscriptionRepository.remove(subscription);

    await this.auditLogService.createAuditLog({
      eventType: AuditEventType.ADMIN,
      action: AuditAction.WEBHOOK_DELETED,
      actorUserId: adminId,
      outcome: AuditOutcome.SUCCESS,
      severity: AuditSeverity.HIGH,
      resourceType: 'WebhookSubscription',
      resourceId: id,
      details: `Deleted webhook subscription ${id}`,
      metadata: { url: subscription.url },
      req,
    });
  }

  async testWebhook(
    id: string,
    adminId: string,
    req?: Request,
  ): Promise<{ responseStatus: number | null; responseBody: string }> {
    const subscription = await this.findOneOrFail(id);

    const payload = {
      event: 'ping',
      timestamp: new Date().toISOString(),
      webhookId: id,
    };

    const result = await this.sendHttpRequest(subscription, payload);

    await this.auditLogService.createAuditLog({
      eventType: AuditEventType.ADMIN,
      action: AuditAction.WEBHOOK_TESTED,
      actorUserId: adminId,
      outcome: result.success ? AuditOutcome.SUCCESS : AuditOutcome.FAILURE,
      severity: AuditSeverity.LOW,
      resourceType: 'WebhookSubscription',
      resourceId: id,
      details: `Test ping sent to ${subscription.url} — status ${result.responseStatus}`,
      metadata: { responseStatus: result.responseStatus },
      req,
    });

    return {
      responseStatus: result.responseStatus,
      responseBody: result.responseBody,
    };
  }

  async getDeliveries(
    subscriptionId: string,
    query: GetWebhookDeliveriesDto,
  ): Promise<{ data: WebhookDelivery[]; total: number; page: number; limit: number }> {
    await this.findOneOrFail(subscriptionId);

    const { page = 1, limit = 20, status, event, startDate, endDate } = query;
    const skip = (page - 1) * limit;

    const where: any = { subscriptionId };
    if (status) where.status = status;
    if (event) where.event = event;
    if (startDate && endDate) {
      where.createdAt = Between(new Date(startDate), new Date(endDate));
    } else if (startDate) {
      where.createdAt = MoreThanOrEqual(new Date(startDate));
    } else if (endDate) {
      where.createdAt = LessThanOrEqual(new Date(endDate));
    }

    const [data, total] = await this.deliveryRepository.findAndCount({
      where,
      order: { createdAt: 'DESC' },
      skip,
      take: limit,
    });

    return { data, total, page, limit };
  }

  async retryDelivery(deliveryId: string, adminId: string): Promise<WebhookDelivery> {
    const delivery = await this.deliveryRepository.findOne({
      where: { id: deliveryId },
    });

    if (!delivery) {
      throw new NotFoundException(`Delivery ${deliveryId} not found`);
    }

    if (delivery.status !== WebhookDeliveryStatus.FAILED) {
      throw new BadRequestException('Only failed deliveries can be retried');
    }

    delivery.status = WebhookDeliveryStatus.PENDING;
    delivery.attemptCount = 0;
    delivery.responseStatus = null;
    delivery.responseBody = null;
    delivery.lastAttemptAt = null;

    const saved = await this.deliveryRepository.save(delivery);

    await this.webhookQueue.add(
      WEBHOOK_JOB_NAME,
      { deliveryId: saved.id },
      { attempts: 3, backoff: { type: 'exponential', delay: 5000 } },
    );

    this.logger.log(`Manual retry queued for delivery ${deliveryId} by admin ${adminId}`);
    return saved;
  }

  // ─── Event Dispatch ─────────────────────────────────────────────────────────

  async dispatchEvent(event: string, payload: Record<string, any>): Promise<void> {
    const subscriptions = await this.subscriptionRepository.find({
      where: { isActive: true },
    });

    const relevant = subscriptions.filter((s) => s.events.includes(event));

    for (const subscription of relevant) {
      const fullPayload = {
        event,
        timestamp: new Date().toISOString(),
        data: payload,
      };

      const delivery = this.deliveryRepository.create({
        subscriptionId: subscription.id,
        event,
        payload: fullPayload,
        status: WebhookDeliveryStatus.PENDING,
        attemptCount: 0,
      });

      const saved = await this.deliveryRepository.save(delivery);

      await this.webhookQueue.add(
        WEBHOOK_JOB_NAME,
        { deliveryId: saved.id },
        { attempts: 3, backoff: { type: 'exponential', delay: 5000 } },
      );
    }
  }

  // ─── Delivery Processing (called by processor) ───────────────────────────────

  async processDelivery(deliveryId: string): Promise<void> {
    const delivery = await this.deliveryRepository.findOne({
      where: { id: deliveryId },
      relations: ['subscription'],
    });

    if (!delivery) {
      throw new Error(`Delivery ${deliveryId} not found`);
    }

    const { subscription } = delivery;

    if (!subscription || !subscription.isActive) {
      delivery.status = WebhookDeliveryStatus.FAILED;
      delivery.responseBody = 'Subscription inactive or deleted';
      await this.deliveryRepository.save(delivery);
      return;
    }

    delivery.attemptCount += 1;
    delivery.lastAttemptAt = new Date();
    await this.deliveryRepository.save(delivery);

    const result = await this.sendHttpRequest(subscription, delivery.payload);

    delivery.responseStatus = result.responseStatus;
    delivery.responseBody = result.responseBody;

    if (result.success) {
      delivery.status = WebhookDeliveryStatus.DELIVERED;
      await this.deliveryRepository.save(delivery);

      // Reset consecutive failures on success
      subscription.consecutiveFailures = 0;
      await this.subscriptionRepository.save(subscription);
    } else {
      // Throw so Bull can retry
      await this.deliveryRepository.save(delivery);
      throw new Error(
        `Webhook delivery failed: HTTP ${result.responseStatus ?? 'no-response'}`,
      );
    }
  }

  async handleDeliveryJobFailed(deliveryId: string): Promise<void> {
    const delivery = await this.deliveryRepository.findOne({
      where: { id: deliveryId },
      relations: ['subscription'],
    });

    if (!delivery) return;

    delivery.status = WebhookDeliveryStatus.FAILED;
    await this.deliveryRepository.save(delivery);

    const subscription = delivery.subscription;
    if (!subscription) return;

    subscription.consecutiveFailures += 1;
    this.logger.warn(
      `Webhook ${subscription.id} consecutive failures: ${subscription.consecutiveFailures}`,
    );

    if (subscription.consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
      subscription.isActive = false;
      this.logger.error(
        `Webhook subscription ${subscription.id} deactivated after ${MAX_CONSECUTIVE_FAILURES} consecutive failures`,
      );
      await this.subscriptionRepository.save(subscription);
      await this.notifySuperAdminsOfDeactivation(subscription);
    } else {
      await this.subscriptionRepository.save(subscription);
    }
  }

  // ─── Signature ───────────────────────────────────────────────────────────────

  generateSignature(payloadString: string, secret: string): string {
    const hmac = createHmac('sha256', secret);
    hmac.update(payloadString);
    return `sha256=${hmac.digest('hex')}`;
  }

  // ─── Private Helpers ─────────────────────────────────────────────────────────

  private async findOneOrFail(id: string): Promise<WebhookSubscription> {
    const subscription = await this.subscriptionRepository.findOne({ where: { id } });
    if (!subscription) {
      throw new NotFoundException(`Webhook subscription ${id} not found`);
    }
    return subscription;
  }

  private async sendHttpRequest(
    subscription: WebhookSubscription,
    payload: Record<string, any>,
  ): Promise<{ success: boolean; responseStatus: number | null; responseBody: string }> {
    const payloadString = JSON.stringify(payload);
    const signature = this.generateSignature(payloadString, subscription.secret);

    try {
      const response = await fetch(subscription.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-GG-Signature': signature,
          'User-Agent': 'GaslessGossip-Webhooks/1.0',
        },
        body: payloadString,
        signal: AbortSignal.timeout(10_000),
      });

      const responseBody = await response.text().catch(() => '');
      const success = response.status >= 200 && response.status < 300;

      return { success, responseStatus: response.status, responseBody };
    } catch (err) {
      this.logger.error(`HTTP request to ${subscription.url} failed: ${err.message}`);
      return { success: false, responseStatus: null, responseBody: err.message };
    }
  }

  private async notifySuperAdminsOfDeactivation(
    subscription: WebhookSubscription,
  ): Promise<void> {
    try {
      const superAdmins = await this.userRepository.find({
        where: { role: UserRole.SUPER_ADMIN },
      });

      if (superAdmins.length === 0) return;

      const notifications = superAdmins.map((admin) =>
        this.notificationRepository.create({
          recipientId: admin.id,
          senderId: null,
          type: NotificationType.SYSTEM,
          title: 'Webhook subscription deactivated',
          message: `Webhook subscription for ${subscription.url} was automatically deactivated after ${MAX_CONSECUTIVE_FAILURES} consecutive delivery failures.`,
          priority: NotificationPriority.HIGH,
          data: { webhookId: subscription.id, url: subscription.url },
          isRead: false,
        }),
      );

      await this.notificationRepository.save(notifications);
    } catch (err) {
      this.logger.error(`Failed to notify super admins: ${err.message}`);
    }
  }
}
