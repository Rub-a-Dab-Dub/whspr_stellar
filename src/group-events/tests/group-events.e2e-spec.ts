import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { GroupEventsController } from '../group-events.controller';
import { GroupEventsService } from '../group-events.service';
import { EventStatus, EventType } from '../entities/group-event.entity';
import { RSVPStatus } from '../entities/event-rsvp.entity';

const groupId = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const eventId = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
const userId = 'cccccccc-cccc-cccc-cccc-cccccccccccc';

const FUTURE = new Date(Date.now() + 2 * 60 * 60_000).toISOString();
const FUTURE_END = new Date(Date.now() + 3 * 60 * 60_000).toISOString();

const baseEvent = {
  id: eventId,
  groupId,
  createdBy: userId,
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
  goingCount: 0,
  maybeCount: 0,
  waitlistedCount: 0,
  createdAt: new Date().toISOString(),
};

const baseRsvp = {
  id: 'rsvp-1',
  eventId,
  userId,
  status: RSVPStatus.GOING,
  respondedAt: new Date().toISOString(),
};

describe('GroupEventsController (e2e)', () => {
  let app: INestApplication;
  let service: jest.Mocked<GroupEventsService>;

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [GroupEventsController],
      providers: [
        {
          provide: GroupEventsService,
          useValue: {
            createEvent: jest.fn().mockResolvedValue(baseEvent),
            getGroupEvents: jest.fn().mockResolvedValue([baseEvent]),
            getEvent: jest.fn().mockResolvedValue(baseEvent),
            updateEvent: jest.fn().mockResolvedValue({ ...baseEvent, title: 'Updated' }),
            cancelEvent: jest.fn().mockResolvedValue(undefined),
            rsvp: jest.fn().mockResolvedValue(baseRsvp),
            getAttendees: jest.fn().mockResolvedValue([
              { userId, status: RSVPStatus.GOING, respondedAt: new Date().toISOString() },
            ]),
          },
        },
      ],
    }).compile();

    app = module.createNestApplication();
    app.setGlobalPrefix('api');
    app.use((req: any, _res: any, next: () => void) => {
      req.user = { id: userId, groupMemberIds: ['user-2', 'user-3'] };
      next();
    });
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();

    service = module.get(GroupEventsService) as jest.Mocked<GroupEventsService>;
  });

  afterAll(() => app.close());

  // ─── POST /groups/:id/events ─────────────────────────────────────────────────

  describe('POST /api/groups/:id/events', () => {
    it('creates event and returns 201', async () => {
      await request(app.getHttpServer())
        .post(`/api/groups/${groupId}/events`)
        .send({
          title: 'Team Standup',
          eventType: EventType.VIRTUAL,
          meetingUrl: 'https://meet.example.com',
          startTime: FUTURE,
          endTime: FUTURE_END,
        })
        .expect(201)
        .expect((res) => {
          expect(res.body.id).toBe(eventId);
          expect(res.body.status).toBe(EventStatus.ACTIVE);
          expect(res.body.goingCount).toBe(0);
        });

      expect(service.createEvent).toHaveBeenCalledWith(
        userId,
        groupId,
        expect.objectContaining({ title: 'Team Standup' }),
        ['user-2', 'user-3'],
      );
    });

    it('rejects title shorter than 3 chars', async () => {
      await request(app.getHttpServer())
        .post(`/api/groups/${groupId}/events`)
        .send({ title: 'AB', eventType: EventType.VIRTUAL, startTime: FUTURE, endTime: FUTURE_END })
        .expect(400);
    });

    it('rejects invalid eventType', async () => {
      await request(app.getHttpServer())
        .post(`/api/groups/${groupId}/events`)
        .send({ title: 'Valid Title', eventType: 'HYBRID', startTime: FUTURE, endTime: FUTURE_END })
        .expect(400);
    });

    it('rejects invalid date format', async () => {
      await request(app.getHttpServer())
        .post(`/api/groups/${groupId}/events`)
        .send({ title: 'Valid Title', eventType: EventType.VIRTUAL, startTime: 'not-a-date', endTime: FUTURE_END })
        .expect(400);
    });
  });

  // ─── GET /groups/:id/events ──────────────────────────────────────────────────

  describe('GET /api/groups/:id/events', () => {
    it('returns list of group events with RSVP counts', async () => {
      await request(app.getHttpServer())
        .get(`/api/groups/${groupId}/events`)
        .expect(200)
        .expect((res) => {
          expect(Array.isArray(res.body)).toBe(true);
          expect(res.body[0].goingCount).toBeDefined();
          expect(res.body[0].maybeCount).toBeDefined();
        });
    });
  });

  // ─── GET /events/:id ─────────────────────────────────────────────────────────

  describe('GET /api/events/:id', () => {
    it('returns event with RSVP counts visible to all members', async () => {
      await request(app.getHttpServer())
        .get(`/api/events/${eventId}`)
        .expect(200)
        .expect((res) => {
          expect(res.body.id).toBe(eventId);
          expect(res.body.goingCount).toBeDefined();
          expect(res.body.maybeCount).toBeDefined();
          expect(res.body.waitlistedCount).toBeDefined();
        });
    });
  });

  // ─── PATCH /events/:id ───────────────────────────────────────────────────────

  describe('PATCH /api/events/:id', () => {
    it('updates event and returns updated record', async () => {
      await request(app.getHttpServer())
        .patch(`/api/events/${eventId}`)
        .send({ title: 'Updated' })
        .expect(200)
        .expect((res) => {
          expect(res.body.title).toBe('Updated');
        });

      expect(service.updateEvent).toHaveBeenCalledWith(userId, eventId, { title: 'Updated' });
    });
  });

  // ─── DELETE /events/:id ──────────────────────────────────────────────────────

  describe('DELETE /api/events/:id', () => {
    it('cancels event with 204 No Content', async () => {
      await request(app.getHttpServer())
        .delete(`/api/events/${eventId}`)
        .expect(204);

      expect(service.cancelEvent).toHaveBeenCalledWith(userId, eventId);
    });
  });

  // ─── POST /events/:id/rsvp ───────────────────────────────────────────────────

  describe('POST /api/events/:id/rsvp', () => {
    it('RSVPs GOING and returns rsvp record', async () => {
      await request(app.getHttpServer())
        .post(`/api/events/${eventId}/rsvp`)
        .send({ status: RSVPStatus.GOING })
        .expect(200)
        .expect((res) => {
          expect(res.body.status).toBe(RSVPStatus.GOING);
          expect(res.body.eventId).toBe(eventId);
        });
    });

    it('RSVPs MAYBE', async () => {
      service.rsvp.mockResolvedValueOnce({ ...baseRsvp, status: RSVPStatus.MAYBE } as any);

      await request(app.getHttpServer())
        .post(`/api/events/${eventId}/rsvp`)
        .send({ status: RSVPStatus.MAYBE })
        .expect(200)
        .expect((res) => {
          expect(res.body.status).toBe(RSVPStatus.MAYBE);
        });
    });

    it('returns WAITLISTED when event is at capacity', async () => {
      service.rsvp.mockResolvedValueOnce({ ...baseRsvp, status: RSVPStatus.WAITLISTED } as any);

      await request(app.getHttpServer())
        .post(`/api/events/${eventId}/rsvp`)
        .send({ status: RSVPStatus.GOING })
        .expect(200)
        .expect((res) => {
          expect(res.body.status).toBe(RSVPStatus.WAITLISTED);
        });
    });

    it('rejects invalid RSVP status', async () => {
      await request(app.getHttpServer())
        .post(`/api/events/${eventId}/rsvp`)
        .send({ status: 'ATTENDING' })
        .expect(400);
    });
  });

  // ─── GET /events/:id/attendees ───────────────────────────────────────────────

  describe('GET /api/events/:id/attendees', () => {
    it('returns attendee list with RSVP statuses', async () => {
      await request(app.getHttpServer())
        .get(`/api/events/${eventId}/attendees`)
        .expect(200)
        .expect((res) => {
          expect(Array.isArray(res.body)).toBe(true);
          expect(res.body[0].userId).toBe(userId);
          expect(res.body[0].status).toBe(RSVPStatus.GOING);
        });
    });
  });
});
