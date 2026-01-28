// src/health/indicators/queue.indicator.ts
import { Injectable } from '@nestjs/common';
import { HealthIndicator, HealthIndicatorResult, HealthCheckError } from '@nestjs/terminus';
import { InjectQueue } from '@nestjs/bull'; // or your queue library
import { Queue } from 'bull';

@Injectable()
export class QueueHealthIndicator extends HealthIndicator {
  constructor(
    @InjectQueue('payment') private paymentQueue: Queue,
    @InjectQueue('notification') private notificationQueue: Queue,
  ) {
    super();
  }

  async isHealthy(queueName: string): Promise<HealthIndicatorResult> {
    const queue = this.getQueue(queueName);
    
    try {
      const [waiting, active, completed, failed, delayed] = await Promise.all([
        queue.getWaitingCount(),
        queue.getActiveCount(),
        queue.getCompletedCount(),
        queue.getFailedCount(),
        queue.getDelayedCount(),
      ]);

      const totalJobs = waiting + active + delayed;
      const isHealthy = totalJobs < 1000 && failed < 100; // Thresholds

      const result = this.getStatus(queueName, isHealthy, {
        waiting,
        active,
        completed,
        failed,
        delayed,
        totalPending: totalJobs,
      });

      if (!isHealthy) {
        throw new HealthCheckError('Queue unhealthy', result);
      }

      return result;
    } catch (error) {
      const result = this.getStatus(queueName, false, {
        message: error.message,
      });
      
      throw new HealthCheckError('Queue check failed', result);
    }
  }

  private getQueue(name: string): Queue {
    switch (name) {
      case 'payment_queue':
        return this.paymentQueue;
      case 'notification_queue':
        return this.notificationQueue;
      default:
        throw new Error(`Unknown queue: ${name}`);
    }
  }
}