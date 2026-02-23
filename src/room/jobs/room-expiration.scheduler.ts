import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';

@Injectable()
export class RoomExpirationScheduler {
  private readonly logger = new Logger(RoomExpirationScheduler.name);

  constructor(
    @InjectQueue('room-expiration')
    private expirationQueue: Queue,
  ) {}

  @Cron(CronExpression.EVERY_10_MINUTES)
  async scheduleExpirationCheck() {
    this.logger.log('Scheduling room expiration check');
    await this.expirationQueue.add('check-expiration', {}, { priority: 1 });
  }
}
