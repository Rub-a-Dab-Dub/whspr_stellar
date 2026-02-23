import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BroadcastNotification } from '../../notifications/entities/broadcast-notification.entity';
import {
  NotificationDelivery,
  DeliveryStatus,
  DeliveryChannel,
} from '../../notifications/entities/notification-delivery.entity';
import { BroadcastStatsDto } from '../dto/broadcast-stats.dto';

@Injectable()
export class BroadcastDeliveryStatsService {
  constructor(
    @InjectRepository(BroadcastNotification)
    private broadcastRepository: Repository<BroadcastNotification>,
    @InjectRepository(NotificationDelivery)
    private deliveryRepository: Repository<NotificationDelivery>,
  ) {}

  async getStats(broadcastId: string): Promise<BroadcastStatsDto> {
    // Verify broadcast exists
    const broadcast = await this.broadcastRepository.findOne({
      where: { id: broadcastId },
    });

    if (!broadcast) {
      throw new NotFoundException('Broadcast not found');
    }

    // Get total targeted
    const totalTargeted = broadcast.estimatedRecipients;

    // Get delivery statistics by channel and status
    const deliveries = await this.deliveryRepository.find({
      where: { broadcastId },
    });

    const totalSent = deliveries.filter(
      (d) =>
        d.status === DeliveryStatus.SENT || d.status === DeliveryStatus.OPENED,
    ).length;

    const totalFailed = deliveries.filter(
      (d) => d.status === DeliveryStatus.FAILED,
    ).length;

    // Get failed user IDs (limit to 100)
    const failedDeliveries = deliveries
      .filter((d) => d.status === DeliveryStatus.FAILED)
      .map((d) => d.userId);

    const failedUserIds = [...new Set(failedDeliveries)].slice(0, 100);
    const failedUserIdsExceeded = failedDeliveries.length > 100;

    // Calculate email open rate
    const emailDeliveries = deliveries.filter(
      (d) => d.channel === DeliveryChannel.EMAIL,
    );
    const emailOpened = emailDeliveries.filter(
      (d) => d.status === DeliveryStatus.OPENED,
    ).length;
    const emailOpenRate =
      emailDeliveries.length > 0
        ? emailOpened /
          emailDeliveries.filter((d) => d.status !== DeliveryStatus.FAILED)
            .length
        : 0;

    // Get stats by channel
    const byChannel = {};

    for (const channel of [
      DeliveryChannel.IN_APP,
      DeliveryChannel.EMAIL,
      DeliveryChannel.PUSH,
    ]) {
      const channelDeliveries = deliveries.filter((d) => d.channel === channel);

      if (channelDeliveries.length > 0) {
        const sent = channelDeliveries.filter(
          (d) =>
            d.status === DeliveryStatus.SENT ||
            d.status === DeliveryStatus.OPENED,
        ).length;

        const failed = channelDeliveries.filter(
          (d) => d.status === DeliveryStatus.FAILED,
        ).length;

        const opened = channelDeliveries.filter(
          (d) => d.status === DeliveryStatus.OPENED,
        ).length;

        byChannel[channel] = {
          sent,
          failed,
          ...(opened > 0 && { opened }),
        };
      }
    }

    // Build timeline - sent per minute
    const timeline = this.buildTimeline(deliveries);

    return {
      broadcastId,
      totalTargeted,
      totalSent,
      totalFailed,
      failedUserIds,
      failedUserIdsExceeded,
      emailOpenRate: parseFloat(emailOpenRate.toFixed(2)),
      byChannel,
      timeline,
    };
  }

  async getFailedRecipients(broadcastId: string): Promise<string[]> {
    // Verify broadcast exists
    const broadcast = await this.broadcastRepository.findOne({
      where: { id: broadcastId },
    });

    if (!broadcast) {
      throw new NotFoundException('Broadcast not found');
    }

    const failedDeliveries = await this.deliveryRepository.find({
      where: {
        broadcastId,
        status: DeliveryStatus.FAILED,
      },
      order: { createdAt: 'DESC' },
    });

    // Return unique user IDs in order of failure
    const seenIds = new Set<string>();
    const uniqueFailedIds: string[] = [];

    for (const delivery of failedDeliveries) {
      if (!seenIds.has(delivery.userId)) {
        seenIds.add(delivery.userId);
        uniqueFailedIds.push(delivery.userId);
      }
    }

    return uniqueFailedIds;
  }

  private buildTimeline(
    deliveries: NotificationDelivery[],
  ): Array<{ minute: number; sent: number }> {
    // Group deliveries by minute from creation
    const timelineMap = new Map<number, number>();

    for (const delivery of deliveries) {
      if (
        delivery.status === DeliveryStatus.SENT ||
        delivery.status === DeliveryStatus.OPENED
      ) {
        const sentDate = delivery.sentAt || delivery.createdAt;
        // Get the minute (rounded down to nearest minute from broadcast start)
        const sentTime = sentDate.getTime();
        const broadcastStart = delivery.createdAt.getTime();
        const minuteOffset = Math.floor((sentTime - broadcastStart) / 60000);

        const current = timelineMap.get(minuteOffset) || 0;
        timelineMap.set(minuteOffset, current + 1);
      }
    }

    // Convert to sorted array
    const timeline = Array.from(timelineMap.entries())
      .map(([minute, sent]) => ({ minute, sent }))
      .sort((a, b) => a.minute - b.minute);

    return timeline;
  }

  async recordDelivery(
    broadcastId: string,
    userId: string,
    channel: DeliveryChannel,
    status: DeliveryStatus,
    failureReason?: string,
  ): Promise<void> {
    const delivery = this.deliveryRepository.create({
      broadcastId,
      userId,
      channel,
      status,
      failureReason,
      sentAt: status !== DeliveryStatus.PENDING ? new Date() : null,
    });

    await this.deliveryRepository.save(delivery);
  }

  async recordDeliveryOpened(
    broadcastId: string,
    userId: string,
    channel: DeliveryChannel,
  ): Promise<void> {
    await this.deliveryRepository.update(
      {
        broadcastId,
        userId,
        channel,
      },
      {
        status: DeliveryStatus.OPENED,
        openedAt: new Date(),
      },
    );
  }
}
