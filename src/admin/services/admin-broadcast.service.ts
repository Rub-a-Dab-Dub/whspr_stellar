import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { InjectQueue } from '@nestjs/bull';
import { Repository, LessThanOrEqual, MoreThanOrEqual } from 'typeorm';
import { Queue, Job } from 'bull';
import { Notification } from '../../notifications/entities/notification.entity';
import { User } from '../../user/entities/user.entity';
import {
  BroadcastNotification,
  BroadcastStatus,
} from '../../notifications/entities/broadcast-notification.entity';
import { BroadcastNotificationDto } from '../dto/broadcast-notification.dto';
import { AuditLogService } from './audit-log.service';
import {
  AuditAction,
  AuditEventType,
  AuditOutcome,
  AuditSeverity,
} from '../entities/audit-log.entity';
import { Request } from 'express';
import { QUEUE_NAMES } from '../../queue/queue.constants';

@Injectable()
export class AdminBroadcastService {
  private readonly logger = new Logger(AdminBroadcastService.name);
  private readonly BATCH_SIZE = 1000;
  private readonly EMAIL_RATE_LIMIT = 500; // per minute

  constructor(
    @InjectRepository(BroadcastNotification)
    private broadcastRepository: Repository<BroadcastNotification>,
    @InjectRepository(Notification)
    private notificationRepository: Repository<Notification>,
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @InjectQueue(QUEUE_NAMES.NOTIFICATIONS)
    private notificationQueue: Queue,
    private auditLogService: AuditLogService,
  ) {}

  async broadcast(
    dto: BroadcastNotificationDto,
    adminId: string,
    req?: Request,
  ): Promise<{
    jobId: string;
    estimatedRecipients: number;
    scheduledAt: string | null;
  }> {
    // Validate dates
    if (dto.scheduledAt) {
      const scheduledDate = new Date(dto.scheduledAt);
      if (scheduledDate <= new Date()) {
        throw new BadRequestException('scheduledAt must be in the future');
      }
    }

    // Estimate recipient count
    const estimatedRecipients = await this.estimateRecipients(
      dto.targetAudience,
    );

    // Create broadcast record
    const broadcast = this.broadcastRepository.create({
      title: dto.title,
      body: dto.body,
      type: dto.type,
      channels: dto.channels,
      targetAudience: dto.targetAudience,
      createdById: adminId,
      estimatedRecipients,
      scheduledAt: dto.scheduledAt ? new Date(dto.scheduledAt) : null,
      status: BroadcastStatus.SCHEDULED,
      jobId: '', // Will be set after job creation
    });

    const savedBroadcast = await this.broadcastRepository.save(broadcast);

    // Queue the job
    const delay = dto.scheduledAt
      ? new Date(dto.scheduledAt).getTime() - Date.now()
      : 0;

    const job = await this.notificationQueue.add(
      {
        type: 'broadcast',
        broadcastId: savedBroadcast.id,
        ...dto,
      },
      {
        delay,
        attempts: 3,
        backoff: { type: 'exponential', delay: 2000 },
        removeOnComplete: true,
      },
    );

    // Update jobId
    savedBroadcast.jobId = job.id.toString();
    await this.broadcastRepository.save(savedBroadcast);

    // Audit log
    await this.auditLogService.createAuditLog({
      actorUserId: adminId,
      action: AuditAction.BROADCAST_NOTIFICATION,
      eventType: AuditEventType.ADMIN,
      outcome: AuditOutcome.SUCCESS,
      severity: AuditSeverity.MEDIUM,
      details: `Broadcast notification "${dto.title}" scheduled. Target: ${dto.targetAudience.scope}. Estimated recipients: ${estimatedRecipients}`,
      metadata: {
        broadcastId: savedBroadcast.id,
        type: dto.type,
        channels: dto.channels,
        targetScope: dto.targetAudience.scope,
        estimatedRecipients,
      },
      resourceType: 'broadcast',
      resourceId: savedBroadcast.id,
      req,
    });

    return {
      jobId: job.id.toString(),
      estimatedRecipients,
      scheduledAt: dto.scheduledAt || null,
    };
  }

  async getBroadcasts(
    page = 1,
    limit = 10,
  ): Promise<{ broadcasts: BroadcastNotification[]; total: number }> {
    const [broadcasts, total] = await this.broadcastRepository.findAndCount({
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    return { broadcasts, total };
  }

  async cancelBroadcast(
    broadcastId: string,
    adminId: string,
    req?: Request,
  ): Promise<void> {
    const broadcast = await this.broadcastRepository.findOne({
      where: { id: broadcastId },
    });

    if (!broadcast) {
      throw new BadRequestException('Broadcast not found');
    }

    if (broadcast.status !== BroadcastStatus.SCHEDULED) {
      throw new BadRequestException('Can only cancel scheduled broadcasts');
    }

    // Remove from queue
    const job = await this.notificationQueue.getJob(broadcast.jobId);
    if (job) {
      await job.remove();
    }

    broadcast.status = BroadcastStatus.CANCELLED;
    await this.broadcastRepository.save(broadcast);

    await this.auditLogService.createAuditLog({
      actorUserId: adminId,
      action: AuditAction.BROADCAST_NOTIFICATION,
      eventType: AuditEventType.ADMIN,
      outcome: AuditOutcome.SUCCESS,
      severity: AuditSeverity.MEDIUM,
      details: `Broadcast notification "${broadcast.title}" cancelled`,
      metadata: {
        broadcastId: broadcast.id,
        reason: 'cancelled_by_admin',
      },
      resourceType: 'broadcast',
      resourceId: broadcast.id,
      req,
    });
  }

  private async estimateRecipients(targetAudience: {
    scope: 'all' | 'filtered';
    filters?: any;
  }): Promise<number> {
    if (targetAudience.scope === 'all') {
      return await this.userRepository.count({
        where: { isBanned: false },
      });
    }

    const query = this.userRepository.createQueryBuilder('user');
    query.where('user.isBanned = :isBanned', { isBanned: false });

    if (targetAudience.filters?.minLevel) {
      query.andWhere('user.level >= :minLevel', {
        minLevel: targetAudience.filters.minLevel,
      });
    }

    if (targetAudience.filters?.status === 'active') {
      query.andWhere(
        '(user.suspendedUntil IS NULL OR user.suspendedUntil <= :now)',
        { now: new Date() },
      );
    }

    if (targetAudience.filters?.joinedBefore) {
      query.andWhere('user.createdAt <= :joinedBefore', {
        joinedBefore: new Date(targetAudience.filters.joinedBefore),
      });
    }

    if (targetAudience.filters?.roomIds?.length > 0) {
      query.leftJoin('user.roomMembers', 'rm', 'rm.roomId IN (:...roomIds)', {
        roomIds: targetAudience.filters.roomIds,
      });
      query.andWhere('rm.id IS NOT NULL');
    }

    return await query.getCount();
  }

  async processBroadcast(broadcastId: string): Promise<void> {
    const broadcast = await this.broadcastRepository.findOne({
      where: { id: broadcastId },
    });

    if (!broadcast) {
      throw new Error(`Broadcast ${broadcastId} not found`);
    }

    broadcast.status = BroadcastStatus.SENDING;
    await this.broadcastRepository.save(broadcast);

    try {
      // Get target user IDs
      const userIds = await this.getTargetUserIds(broadcast.targetAudience);

      // Process in_app channel
      if (broadcast.channels.includes('in_app')) {
        await this.sendInAppNotifications(userIds, broadcast);
      }

      // Process email channel
      if (broadcast.channels.includes('email')) {
        await this.sendEmailNotifications(userIds, broadcast);
      }

      broadcast.status = BroadcastStatus.COMPLETE;
      broadcast.sentAt = new Date();
      broadcast.deliveredCount = userIds.length;
      await this.broadcastRepository.save(broadcast);
    } catch (error) {
      this.logger.error(`Failed to process broadcast ${broadcastId}:`, error);
      broadcast.status = BroadcastStatus.FAILED;
      broadcast.metadata = { errorMessage: error.message };
      await this.broadcastRepository.save(broadcast);
      throw error;
    }
  }

  private async getTargetUserIds(targetAudience: {
    scope: 'all' | 'filtered';
    filters?: any;
  }): Promise<string[]> {
    const query = this.userRepository.createQueryBuilder('user');
    query.select('user.id');
    query.where('user.isBanned = :isBanned', { isBanned: false });

    if (targetAudience.scope === 'filtered') {
      if (targetAudience.filters?.minLevel) {
        query.andWhere('user.level >= :minLevel', {
          minLevel: targetAudience.filters.minLevel,
        });
      }

      if (targetAudience.filters?.status === 'active') {
        query.andWhere(
          '(user.suspendedUntil IS NULL OR user.suspendedUntil <= :now)',
          { now: new Date() },
        );
      }

      if (targetAudience.filters?.joinedBefore) {
        query.andWhere('user.createdAt <= :joinedBefore', {
          joinedBefore: new Date(targetAudience.filters.joinedBefore),
        });
      }

      if (targetAudience.filters?.roomIds?.length > 0) {
        query.leftJoin('user.roomMembers', 'rm', 'rm.roomId IN (:...roomIds)', {
          roomIds: targetAudience.filters.roomIds,
        });
        query.andWhere('rm.id IS NOT NULL');
        query.distinct(true);
      }
    }

    const results = await query.getRawMany();
    return results.map((r) => r.user_id);
  }

  private async sendInAppNotifications(
    userIds: string[],
    broadcast: BroadcastNotification,
  ): Promise<void> {
    const notifications: Partial<Notification>[] = userIds.map((userId) => ({
      recipientId: userId,
      type: 'system' as any,
      title: broadcast.title,
      message: broadcast.body,
      data: {
        broadcastId: broadcast.id,
        type: broadcast.type,
      },
      isRead: false,
    }));

    // Insert in batches
    for (let i = 0; i < notifications.length; i += this.BATCH_SIZE) {
      const batch = notifications.slice(i, i + this.BATCH_SIZE);
      await this.notificationRepository.insert(batch);
    }
  }

  private async sendEmailNotifications(
    userIds: string[],
    broadcast: BroadcastNotification,
  ): Promise<void> {
    // Get user emails
    const users = await this.userRepository.find({
      where: { id: userIds as any },
      select: ['id', 'email'],
    });

    // Queue emails with rate limiting
    const emailInterval = 60000 / this.EMAIL_RATE_LIMIT; // ms between emails

    for (let i = 0; i < users.length; i++) {
      const user = users[i];
      const delay = i * emailInterval;

      await this.notificationQueue.add(
        {
          type: 'email',
          to: user.email,
          subject: broadcast.title,
          body: broadcast.body,
          broadcastId: broadcast.id,
        },
        {
          delay: Math.floor(delay),
        },
      );
    }
  }
}
