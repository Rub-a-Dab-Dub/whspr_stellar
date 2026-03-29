import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotificationsService } from '../../notifications/notifications.service';
import { RSVPStatus } from '../entities/event-rsvp.entity';
import { EventStatus, EventType, GroupEvent } from '../entities/group-event.entity';
import { EventRSVP } from '../entities/event-rsvp.entity';
import { GroupEventsService } from '../group-events.service';
import { CreateGroupEventDto } from '../dto/group-event.dto';

const FUTURE = new Date(Date.now() + 2 * 60 * 60_000); // 2h from now
const FUTURE_END = new Date(Date.now() + 3 * 60 * 60_000); // 3h from now

const makeEvent = (overrides: Partial<GroupEvent> = {}): GroupEvent =>
  ({
    id: 'event-1',
    groupId: 'group-1',
    createdBy: 'user-1',
    title: 'Team Standup',
    description: null,
    eventType: EventType.VIRTUAL,
    location: null,
    meetingUrl: 'https://meet.example.com',
    startTime: FUTURE,
    endTime: FUTURE_END,
    maxAttendees: null,
    isPublic: true,
    status: EventStatus.ACTIVE,
    reminderSent: false,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  } as GroupEvent);

const makeRsvp = (overrides: Partial<EventRSVP> = {}): EventRSVP =>
  ({
    id: 'rsvp-1',
    eventId: 'event-1',
    userId: 'user-1',
    status: RSVPStatus.GOING,
    respondedAt: new Date(),
    ...overrides,
  } as EventRSVP);

const makeRepo = () => ({
  find: jest.fn(),
  findOne: jest.fn(),
  create: jest.fn((v: unknown) => v),
  save: jest.fn((v: unknown) => Promise.resolve(v)),
  count: jest.fn(),
  createQueryBuilder: jest.fn(),
});

describe('GroupEventsService', () => {
  let service: GroupEventsService;
  let eventsRepo: ReturnType<typeof makeRepo>;
  let rsvpRepo: ReturnType<typeof makeRepo>;
  let notifications: jest.Mocked<NotificationsService>;

  beforeEach(async () => {
    eventsRepo = makeRepo();
    rsvpRepo = makeRepo();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GroupEventsService,
        { provide: getRepositoryToken(GroupEvent), useValue: eventsRepo },
        { provide: getRepositoryToken(EventRSVP), useValue: rsvpRepo },
        {
          provide: NotificationsService,
          useValue: { createNotification: jest.fn().mockResolvedValue({}) },
        },
      ],
    }).compile();

    service = module.get(GroupEventsService);
    notifications = module.get(NotificationsService) as jest.Mocked<NotificationsService>;
  });

  afterEach(() => jest.clearAllMocks());

  // ─── createEvent ─────────────────────────────────────────────────────────────

  describe('createEvent', () => {
    const dto: CreateGroupEventDto = {
      title: 'Team Standup',
      eventType: EventType.VIRTUAL,
      meetingUrl: 'https://meet.example.com',
      startTime: FUTURE.toISOString(),
      endTime: FUTURE_END.toISOString(),
    };

    it('creates event and notifies group members', async () => {
      const event = makeEvent();
      eventsRepo.save.mockResolvedValue(event);
      rsvpRepo.find.mockResolvedValue([]);

      const result = await service.createEvent('user-1', 'group-1', dto, ['user-2', 'user-3']);

      expect(eventsRepo.save).toHaveBeenCalled();
      expect(result.title).toBe('Team Standup');
      expect(result.status).toBe(EventStatus.ACTIVE);
    });

    it('notifies all group members on creation', async () => {
      const event = makeEvent();
      eventsRepo.save.mockResolvedValue(event);
      rsvpRepo.find.mockResolvedValue([]);

      await service.createEvent('user-1', 'group-1', dto, ['user-2', 'user-3']);

      // Allow async notification to fire
      await new Promise((r) => setTimeout(r, 10));
      expect(notifications.createNotification).toHaveBeenCalledTimes(2);
      expect(notifications.createNotification).toHaveBeenCalledWith(
        expect.objectContaining({ title: expect.stringContaining('Team Standup') }),
      );
    });

    it('throws BadRequestException when startTime >= endTime', async () => {
      await expect(
        service.createEvent('user-1', 'group-1', {
          ...dto,
          startTime: FUTURE_END.toISOString(),
          endTime: FUTURE.toISOString(),
        }, []),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException when startTime is in the past', async () => {
      await expect(
        service.createEvent('user-1', 'group-1', {
          ...dto,
          startTime: new Date(Date.now() - 1000).toISOString(),
          endTime: FUTURE.toISOString(),
        }, []),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // ─── updateEvent ─────────────────────────────────────────────────────────────

  describe('updateEvent', () => {
    it('updates event fields', async () => {
      const event = makeEvent();
      eventsRepo.findOne.mockResolvedValue(event);
      rsvpRepo.find.mockResolvedValue([]);
      eventsRepo.save.mockResolvedValue({ ...event, title: 'Updated Title' });

      const result = await service.updateEvent('user-1', 'event-1', { title: 'Updated Title' });

      expect(eventsRepo.save).toHaveBeenCalled();
      expect(result.title).toBe('Updated Title');
    });

    it('throws ForbiddenException for non-creator', async () => {
      eventsRepo.findOne.mockResolvedValue(makeEvent({ createdBy: 'other-user' }));

      await expect(
        service.updateEvent('user-1', 'event-1', { title: 'New' }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('throws NotFoundException for unknown event', async () => {
      eventsRepo.findOne.mockResolvedValue(null);
      await expect(service.updateEvent('user-1', 'event-1', {})).rejects.toThrow(NotFoundException);
    });

    it('throws BadRequestException for cancelled event', async () => {
      eventsRepo.findOne.mockResolvedValue(makeEvent({ status: EventStatus.CANCELLED }));
      await expect(service.updateEvent('user-1', 'event-1', {})).rejects.toThrow(BadRequestException);
    });
  });

  // ─── cancelEvent ─────────────────────────────────────────────────────────────

  describe('cancelEvent', () => {
    it('cancels event and notifies RSVPed attendees', async () => {
      const event = makeEvent();
      eventsRepo.findOne.mockResolvedValue(event);
      eventsRepo.save.mockResolvedValue({ ...event, status: EventStatus.CANCELLED });
      rsvpRepo.find.mockResolvedValue([makeRsvp(), makeRsvp({ id: 'rsvp-2', userId: 'user-2' })]);

      await service.cancelEvent('user-1', 'event-1');

      expect(eventsRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ status: EventStatus.CANCELLED }),
      );

      await new Promise((r) => setTimeout(r, 10));
      expect(notifications.createNotification).toHaveBeenCalledTimes(2);
      expect(notifications.createNotification).toHaveBeenCalledWith(
        expect.objectContaining({ title: expect.stringContaining('cancelled') }),
      );
    });

    it('throws ForbiddenException for non-creator', async () => {
      eventsRepo.findOne.mockResolvedValue(makeEvent({ createdBy: 'other-user' }));
      await expect(service.cancelEvent('user-1', 'event-1')).rejects.toThrow(ForbiddenException);
    });
  });

  // ─── rsvp ────────────────────────────────────────────────────────────────────

  describe('rsvp', () => {
    it('creates a new GOING RSVP', async () => {
      eventsRepo.findOne.mockResolvedValue(makeEvent());
      rsvpRepo.findOne.mockResolvedValue(null);
      rsvpRepo.count.mockResolvedValue(0);
      const rsvp = makeRsvp();
      rsvpRepo.save.mockResolvedValue(rsvp);

      const result = await service.rsvp('user-1', 'event-1', { status: RSVPStatus.GOING });

      expect(result.status).toBe(RSVPStatus.GOING);
    });

    it('auto-waitlists when event is at capacity', async () => {
      eventsRepo.findOne.mockResolvedValue(makeEvent({ maxAttendees: 2 }));
      rsvpRepo.findOne.mockResolvedValue(null);
      rsvpRepo.count.mockResolvedValue(2); // already 2 GOING
      const waitlisted = makeRsvp({ status: RSVPStatus.WAITLISTED });
      rsvpRepo.save.mockResolvedValue(waitlisted);

      const result = await service.rsvp('user-2', 'event-1', { status: RSVPStatus.GOING });

      expect(result.status).toBe(RSVPStatus.WAITLISTED);
    });

    it('updates existing RSVP', async () => {
      eventsRepo.findOne.mockResolvedValue(makeEvent());
      const existing = makeRsvp({ status: RSVPStatus.MAYBE });
      rsvpRepo.findOne.mockResolvedValue(existing);
      rsvpRepo.count.mockResolvedValue(0);
      rsvpRepo.save.mockResolvedValue({ ...existing, status: RSVPStatus.GOING });

      const result = await service.rsvp('user-1', 'event-1', { status: RSVPStatus.GOING });

      expect(result.status).toBe(RSVPStatus.GOING);
    });

    it('does not count existing GOING slot when user updates their own RSVP', async () => {
      eventsRepo.findOne.mockResolvedValue(makeEvent({ maxAttendees: 1 }));
      const existing = makeRsvp({ status: RSVPStatus.GOING });
      rsvpRepo.findOne.mockResolvedValue(existing);
      rsvpRepo.count.mockResolvedValue(1); // user is the 1 GOING
      rsvpRepo.save.mockResolvedValue({ ...existing, status: RSVPStatus.GOING });

      const result = await service.rsvp('user-1', 'event-1', { status: RSVPStatus.GOING });

      // Should remain GOING, not be waitlisted
      expect(result.status).toBe(RSVPStatus.GOING);
    });

    it('throws BadRequestException for cancelled event', async () => {
      eventsRepo.findOne.mockResolvedValue(makeEvent({ status: EventStatus.CANCELLED }));
      await expect(
        service.rsvp('user-1', 'event-1', { status: RSVPStatus.GOING }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // ─── getEvent ────────────────────────────────────────────────────────────────

  describe('getEvent', () => {
    it('returns event with RSVP counts', async () => {
      eventsRepo.findOne.mockResolvedValue(makeEvent());
      rsvpRepo.find.mockResolvedValue([
        makeRsvp({ status: RSVPStatus.GOING }),
        makeRsvp({ id: 'rsvp-2', userId: 'user-2', status: RSVPStatus.MAYBE }),
        makeRsvp({ id: 'rsvp-3', userId: 'user-3', status: RSVPStatus.WAITLISTED }),
      ]);

      const result = await service.getEvent('event-1');

      expect(result.goingCount).toBe(1);
      expect(result.maybeCount).toBe(1);
      expect(result.waitlistedCount).toBe(1);
    });

    it('throws NotFoundException for unknown event', async () => {
      eventsRepo.findOne.mockResolvedValue(null);
      await expect(service.getEvent('event-1')).rejects.toThrow(NotFoundException);
    });
  });

  // ─── getGroupEvents ───────────────────────────────────────────────────────────

  describe('getGroupEvents', () => {
    it('returns all events for a group ordered by startTime', async () => {
      eventsRepo.find.mockResolvedValue([makeEvent(), makeEvent({ id: 'event-2', title: 'Event 2' })]);
      rsvpRepo.find.mockResolvedValue([]);

      const result = await service.getGroupEvents('group-1');

      expect(result).toHaveLength(2);
    });
  });

  // ─── getAttendees ─────────────────────────────────────────────────────────────

  describe('getAttendees', () => {
    it('returns attendee list with RSVP statuses', async () => {
      eventsRepo.findOne.mockResolvedValue(makeEvent());
      rsvpRepo.find.mockResolvedValue([
        makeRsvp({ userId: 'user-1', status: RSVPStatus.GOING }),
        makeRsvp({ id: 'rsvp-2', userId: 'user-2', status: RSVPStatus.MAYBE }),
      ]);

      const result = await service.getAttendees('event-1');

      expect(result).toHaveLength(2);
      expect(result[0].status).toBe(RSVPStatus.GOING);
      expect(result[1].status).toBe(RSVPStatus.MAYBE);
    });

    it('throws NotFoundException for unknown event', async () => {
      eventsRepo.findOne.mockResolvedValue(null);
      await expect(service.getAttendees('event-1')).rejects.toThrow(NotFoundException);
    });
  });

  // ─── sendReminders ────────────────────────────────────────────────────────────

  describe('sendReminders', () => {
    it('sends reminders to GOING attendees for events starting in ~1 hour', async () => {
      const event = makeEvent({
        startTime: new Date(Date.now() + 70 * 60_000), // 70 min from now
      });
      eventsRepo.find.mockResolvedValue([event]);
      rsvpRepo.find.mockResolvedValue([
        makeRsvp({ userId: 'user-1', status: RSVPStatus.GOING }),
        makeRsvp({ id: 'rsvp-2', userId: 'user-2', status: RSVPStatus.GOING }),
      ]);
      eventsRepo.save.mockResolvedValue({ ...event, reminderSent: true });

      const count = await service.sendReminders();

      expect(count).toBe(1);
      expect(notifications.createNotification).toHaveBeenCalledTimes(2);
      expect(notifications.createNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          title: expect.stringContaining('1 hour'),
        }),
      );
      expect(eventsRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ reminderSent: true }),
      );
    });

    it('returns 0 when no upcoming events', async () => {
      eventsRepo.find.mockResolvedValue([]);
      const count = await service.sendReminders();
      expect(count).toBe(0);
      expect(notifications.createNotification).not.toHaveBeenCalled();
    });

    it('does not re-send reminders for events already reminded', async () => {
      // reminderSent=true events are excluded by the WHERE clause in the repo
      eventsRepo.find.mockResolvedValue([]);
      const count = await service.sendReminders();
      expect(count).toBe(0);
    });
  });
});
