import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { NotificationsModule } from '../notifications/notifications.module';
import { EventRSVP } from './entities/event-rsvp.entity';
import { GroupEvent } from './entities/group-event.entity';
import { GroupEventsController } from './group-events.controller';
import { GroupEventsReminderJob } from './group-events-reminder.job';
import { GroupEventsService } from './group-events.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([GroupEvent, EventRSVP]),
    NotificationsModule,
  ],
  controllers: [GroupEventsController],
  providers: [GroupEventsService, GroupEventsReminderJob],
  exports: [GroupEventsService],
})
export class GroupEventsModule {}
