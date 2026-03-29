import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, In, LessThan, Repository } from 'typeorm';
import { InAppNotificationType } from '../notifications/entities/notification.entity';
import { NotificationsService } from '../notifications/notifications.service';
import {
  AttendeeResponseDto,
  CreateGroupEventDto,
  EventRsvpResponseDto,
  GroupEventResponseDto,
  RsvpDto,
  UpdateGroupEventDto,
} from './dto/group-event.dto';
import { EventRSVP, RSVPStatus } from './entities/event-rsvp.entity';
import { EventStatus, GroupEvent } from './entities/group-event.entity';

@Injectable()
export class GroupEventsService {
  private readonly logger = new Logger(GroupEventsService.name);

  constructor(
    @InjectRepository(GroupEvent)
    private readonly eventsRepo: Repository<GroupEvent>,
    @InjectRepository(EventRSVP)
    private readonly rsvpRepo: Repository<EventRSVP>,
    private readonly notifications: NotificationsService,
  ) {}

  // ─── CRUD ────────────────────────────────────────────────────────────────────

  async createEvent(
    userId: string,
    groupId: string,
    dto: CreateGroupEventDto,
    groupMemberIds: string[],
  ): Promise<GroupEventResponseDto> {
    const startTime = new Date(dto.startTime);
    const endTime = new Date(dto.endTime);
    this.validateTimes(startTime, endTime);

    const event = this.eventsRepo.create({
      groupId,
      createdBy: userId,
      title: dto.title,
      description: dto.description ?? null,
      eventType: dto.eventType,
      location: dto.location ?? null,
      meetingUrl: dto.meetingUrl ?? null,
      startTime,
      endTime,
      maxAttendees: dto.maxAttendees ?? null,
      isPublic: dto.isPublic ?? true,
      status: EventStatus.ACTIVE,
      reminderSent: false,
    });

    const saved = await this.eventsRepo.save(event);

    // Notify all group members (fire-and-forget, non-blocking)
    this.notifyGroupMembers(groupMemberIds, saved, 'new_event').catch((err: unknown) =>
      this.logger.warn(`Failed to notify members for event ${saved.id}: ${String(err)}`),
    );

    return this.toEventDto(saved, []);
  }

  async updateEvent(
    userId: string,
    eventId: string,
    dto: UpdateGroupEventDto,
  ): Promise<GroupEventResponseDto> {
    const event = await this.getActiveEventOrThrow(eventId);
    this.assertCreator(event, userId);

    if (dto.startTime || dto.endTime) {
      const startTime = dto.startTime ? new Date(dto.startTime) : event.startTime;
      const endTime = dto.endTime ? new Date(dto.endTime) : event.endTime;
      this.validateTimes(startTime, endTime);
      event.startTime = startTime;
      event.endTime = endTime;
    }

    if (dto.title !== undefined) event.title = dto.title;
    if (dto.description !== undefined) event.description = dto.description ?? null;
    if (dto.location !== undefined) event.location = dto.location ?? null;
    if (dto.meetingUrl !== undefined) event.meetingUrl = dto.meetingUrl ?? null;
    if (dto.maxAttendees !== undefined) event.maxAttendees = dto.maxAttendees ?? null;
    if (dto.isPublic !== undefined) event.isPublic = dto.isPublic;

    const saved = await this.eventsRepo.save(event);
    const rsvps = await this.rsvpRepo.find({ where: { eventId } });
    return this.toEventDto(saved, rsvps);
  }

  async cancelEvent(userId: string, eventId: string): Promise<void> {
    const event = await this.getActiveEventOrThrow(eventId);
    this.assertCreator(event, userId);

    event.status = EventStatus.CANCELLED;
    await this.eventsRepo.save(event);

    // Notify all RSVPed attendees
    const rsvps = await this.rsvpRepo.find({ where: { eventId } });
    const attendeeIds = rsvps.map((r) => r.userId);
    this.notifyGroupMembers(attendeeIds, event, 'cancelled').catch((err: unknown) =>
      this.logger.warn(`Failed to notify attendees for cancelled event ${eventId}: ${String(err)}`),
    );
  }

  async rsvp(
    userId: string,
    eventId: string,
    dto: RsvpDto,
  ): Promise<EventRsvpResponseDto> {
    const event = await this.getActiveEventOrThrow(eventId);

    let rsvp = await this.rsvpRepo.findOne({ where: { eventId, userId } });

    // Determine effective status considering waitlist
    let effectiveStatus = dto.status;
    if (dto.status === RSVPStatus.GOING && event.maxAttendees !== null) {
      const goingCount = await this.rsvpRepo.count({
        where: { eventId, status: RSVPStatus.GOING },
      });
      // Don't count the current user's existing GOING slot
      const alreadyGoing = rsvp?.status === RSVPStatus.GOING;
      const availableSlots = event.maxAttendees - goingCount + (alreadyGoing ? 1 : 0);
      if (availableSlots <= 0) {
        effectiveStatus = RSVPStatus.WAITLISTED;
      }
    }

    if (rsvp) {
      rsvp.status = effectiveStatus;
    } else {
      rsvp = this.rsvpRepo.create({ eventId, userId, status: effectiveStatus });
    }

    const saved = await this.rsvpRepo.save(rsvp);
    return this.toRsvpDto(saved);
  }

  async getEvent(eventId: string): Promise<GroupEventResponseDto> {
    const event = await this.eventsRepo.findOne({ where: { id: eventId } });
    if (!event) throw new NotFoundException('Event not found.');
    const rsvps = await this.rsvpRepo.find({ where: { eventId } });
    return this.toEventDto(event, rsvps);
  }

  async getGroupEvents(groupId: string): Promise<GroupEventResponseDto[]> {
    const events = await this.eventsRepo.find({
      where: { groupId },
      order: { startTime: 'ASC' },
    });

    return Promise.all(
      events.map(async (event) => {
        const rsvps = await this.rsvpRepo.find({ where: { eventId: event.id } });
        return this.toEventDto(event, rsvps);
      }),
    );
  }

  async getAttendees(eventId: string): Promise<AttendeeResponseDto[]> {
    const event = await this.eventsRepo.findOne({ where: { id: eventId } });
    if (!event) throw new NotFoundException('Event not found.');

    const rsvps = await this.rsvpRepo.find({
      where: { eventId },
      order: { respondedAt: 'ASC' },
    });

    return rsvps.map((r) => ({
      userId: r.userId,
      status: r.status,
      respondedAt: r.respondedAt,
    }));
  }

  // ─── Reminder cron ───────────────────────────────────────────────────────────

  async sendReminders(): Promise<number> {
    const now = new Date();
    const oneHourFromNow = new Date(now.getTime() + 60 * 60_000);
    const twoHoursFromNow = new Date(now.getTime() + 2 * 60 * 60_000);

    // Events starting within the next 1-2 hours that haven't had reminders sent
    const upcomingEvents = await this.eventsRepo.find({
      where: {
        status: EventStatus.ACTIVE,
        reminderSent: false,
        startTime: Between(oneHourFromNow, twoHoursFromNow),
      },
    });

    if (upcomingEvents.length === 0) return 0;

    let reminded = 0;
    for (const event of upcomingEvents) {
      const goingRsvps = await this.rsvpRepo.find({
        where: { eventId: event.id, status: RSVPStatus.GOING },
      });

      const attendeeIds = goingRsvps.map((r) => r.userId);
      if (attendeeIds.length > 0) {
        await Promise.allSettled(
          attendeeIds.map((uid) =>
            this.notifications.createNotification({
              userId: uid,
              type: InAppNotificationType.EVENT_REMINDER,
              title: `Reminder: ${event.title} starts in ~1 hour`,
              body: event.location
                ? `📍 ${event.location}`
                : event.meetingUrl
                  ? `🔗 ${event.meetingUrl}`
                  : 'Check the event for details.',
              data: { eventId: event.id, groupId: event.groupId },
            }),
          ),
        );
      }

      event.reminderSent = true;
      await this.eventsRepo.save(event);
      reminded++;
    }

    return reminded;
  }

  // ─── Private helpers ─────────────────────────────────────────────────────────

  private async notifyGroupMembers(
    memberIds: string[],
    event: GroupEvent,
    reason: 'new_event' | 'cancelled',
  ): Promise<void> {
    const isNew = reason === 'new_event';
    const title = isNew
      ? `New event: ${event.title}`
      : `Event cancelled: ${event.title}`;
    const body = isNew
      ? `Starts ${event.startTime.toISOString()}`
      : `The event "${event.title}" has been cancelled.`;

    await Promise.allSettled(
      memberIds.map((uid) =>
        this.notifications.createNotification({
          userId: uid,
          type: InAppNotificationType.GROUP_EVENT,
          title,
          body,
          data: { eventId: event.id, groupId: event.groupId },
        }),
      ),
    );
  }

  private async getActiveEventOrThrow(eventId: string): Promise<GroupEvent> {
    const event = await this.eventsRepo.findOne({ where: { id: eventId } });
    if (!event) throw new NotFoundException('Event not found.');
    if (event.status === EventStatus.CANCELLED) {
      throw new BadRequestException('Event has been cancelled.');
    }
    return event;
  }

  private assertCreator(event: GroupEvent, userId: string): void {
    if (event.createdBy !== userId) {
      throw new ForbiddenException('Only the event creator can perform this action.');
    }
  }

  private validateTimes(startTime: Date, endTime: Date): void {
    if (isNaN(startTime.getTime()) || isNaN(endTime.getTime())) {
      throw new BadRequestException('Invalid date format.');
    }
    if (startTime >= endTime) {
      throw new BadRequestException('startTime must be before endTime.');
    }
    if (startTime <= new Date()) {
      throw new BadRequestException('startTime must be in the future.');
    }
  }

  private toEventDto(event: GroupEvent, rsvps: EventRSVP[]): GroupEventResponseDto {
    return {
      id: event.id,
      groupId: event.groupId,
      createdBy: event.createdBy,
      title: event.title,
      description: event.description,
      eventType: event.eventType,
      location: event.location,
      meetingUrl: event.meetingUrl,
      startTime: event.startTime,
      endTime: event.endTime,
      maxAttendees: event.maxAttendees,
      isPublic: event.isPublic,
      status: event.status,
      goingCount: rsvps.filter((r) => r.status === RSVPStatus.GOING).length,
      maybeCount: rsvps.filter((r) => r.status === RSVPStatus.MAYBE).length,
      waitlistedCount: rsvps.filter((r) => r.status === RSVPStatus.WAITLISTED).length,
      createdAt: event.createdAt,
    };
  }

  private toRsvpDto(rsvp: EventRSVP): EventRsvpResponseDto {
    return {
      id: rsvp.id,
      eventId: rsvp.eventId,
      userId: rsvp.userId,
      status: rsvp.status,
      respondedAt: rsvp.respondedAt,
    };
  }
}
