import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { GroupEventsService } from './group-events.service';

@Injectable()
export class GroupEventsReminderJob {
  private readonly logger = new Logger(GroupEventsReminderJob.name);

  constructor(private readonly service: GroupEventsService) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async sendReminders(): Promise<void> {
    const count = await this.service.sendReminders();
    if (count > 0) {
      this.logger.log(`Sent 1-hour reminders for ${count} upcoming event(s).`);
    }
  }
}
