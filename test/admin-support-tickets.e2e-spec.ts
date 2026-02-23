import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { getRepositoryToken } from '@nestjs/typeorm';
import { SupportTicketController } from '../src/admin/controllers/support-ticket.controller';
import { SupportTicketService } from '../src/admin/services/support-ticket.service';
import { SupportTicket } from '../src/admin/entities/support-ticket.entity';
import { TicketMessage, TicketAuthorType } from '../src/admin/entities/ticket-message.entity';
import { User } from '../src/user/entities/user.entity';
import { Notification } from '../src/notifications/entities/notification.entity';
import { AuditLogService } from '../src/admin/services/audit-log.service';
import { RoleGuard } from '../src/roles/guards/role.guard';
import { TicketStatus } from '../src/admin/enums/ticket-status.enum';
import { TicketCategory } from '../src/admin/enums/ticket-category.enum';
import { TicketPriority } from '../src/admin/enums/ticket-priority.enum';

const ADMIN_ID = 'admin-uuid-e2e';
const USER_ID = 'user-uuid-e2e';
const TICKET_ID = 'ticket-uuid-e2e';

const mockUser = {
  id: ADMIN_ID,
  role: 'admin',
  roles: [{ name: 'admin' }],
};

const baseTicket: Partial<SupportTicket> = {
  id: TICKET_ID,
  userId: USER_ID,
  subject: 'I cannot withdraw funds',
  description: 'Getting 500 error when I click withdraw',
  category: TicketCategory.TRANSACTION,
  status: TicketStatus.OPEN,
  priority: TicketPriority.HIGH,
  assignedToId: null,
  resolvedAt: null,
  messages: [],
  createdAt: new Date('2024-06-01T12:00:00Z'),
  updatedAt: new Date('2024-06-01T12:00:00Z'),
};

describe('Support Tickets (e2e)', () => {
  let app: INestApplication;
  let ticketRepo: any;
  let messageRepo: any;
  let userRepo: any;
  let notificationRepo: any;
  let qbMock: any;

  beforeAll(async () => {
    qbMock = {
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getManyAndCount: jest.fn().mockResolvedValue([[baseTicket], 1]),
      update: jest.fn().mockReturnThis(),
      set: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      execute: jest.fn().mockResolvedValue({ affected: 0 }),
    };

    ticketRepo = {
      findOne: jest.fn().mockResolvedValue(baseTicket),
      update: jest.fn().mockResolvedValue({ affected: 1 }),
      createQueryBuilder: jest.fn().mockReturnValue(qbMock),
    };
    messageRepo = {
      create: jest.fn().mockImplementation((d) => d),
      save: jest
        .fn()
        .mockImplementation((d) => Promise.resolve({ id: 'msg-uuid', ...d })),
    };
    userRepo = {
      findOne: jest.fn().mockResolvedValue({ id: ADMIN_ID }),
    };
    notificationRepo = {
      create: jest.fn().mockImplementation((d) => d),
      save: jest.fn().mockResolvedValue({}),
    };

    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [SupportTicketController],
      providers: [
        SupportTicketService,
        { provide: getRepositoryToken(SupportTicket), useValue: ticketRepo },
        { provide: getRepositoryToken(TicketMessage), useValue: messageRepo },
        { provide: getRepositoryToken(User), useValue: userRepo },
        { provide: getRepositoryToken(Notification), useValue: notificationRepo },
        {
          provide: AuditLogService,
          useValue: { createAuditLog: jest.fn().mockResolvedValue({}) },
        },
      ],
    })
      .overrideGuard(RoleGuard)
      .useValue({ canActivate: () => true })
      .compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true }),
    );

    // Inject mock admin user into every request
    app.use((req: any, _res: any, next: any) => {
      req.user = mockUser;
      next();
    });

    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  // ─── GET /admin/support/tickets ───────────────────────────────────────────

  describe('GET /admin/support/tickets', () => {
    it('returns paginated ticket list', async () => {
      const res = await request(app.getHttpServer())
        .get('/admin/support/tickets')
        .expect(200);

      expect(res.body.data).toBeDefined();
      expect(res.body.total).toBe(1);
      expect(res.body.page).toBe(1);
    });

    it('accepts status filter in query string', async () => {
      await request(app.getHttpServer())
        .get('/admin/support/tickets?status=open')
        .expect(200);
    });

    it('rejects invalid status value', async () => {
      await request(app.getHttpServer())
        .get('/admin/support/tickets?status=invalid_status')
        .expect(400);
    });

    it('rejects invalid priority value', async () => {
      await request(app.getHttpServer())
        .get('/admin/support/tickets?priority=extreme')
        .expect(400);
    });
  });

  // ─── GET /admin/support/tickets/:ticketId ─────────────────────────────────

  describe('GET /admin/support/tickets/:ticketId', () => {
    it('returns ticket detail with messages array', async () => {
      const msg1 = {
        id: 'm1',
        body: 'First',
        authorType: TicketAuthorType.USER,
        createdAt: new Date('2024-06-01T13:00:00Z'),
      } as TicketMessage;
      ticketRepo.findOne.mockResolvedValueOnce({ ...baseTicket, messages: [msg1] });

      const res = await request(app.getHttpServer())
        .get(`/admin/support/tickets/${TICKET_ID}`)
        .expect(200);

      expect(res.body.id).toBe(TICKET_ID);
      expect(Array.isArray(res.body.messages)).toBe(true);
    });

    it('returns 404 for unknown ticket', async () => {
      ticketRepo.findOne.mockResolvedValueOnce(null);

      await request(app.getHttpServer())
        .get('/admin/support/tickets/nonexistent-id')
        .expect(404);
    });
  });

  // ─── POST /admin/support/tickets/:ticketId/messages ───────────────────────

  describe('POST /admin/support/tickets/:ticketId/messages', () => {
    beforeEach(() => {
      ticketRepo.findOne.mockResolvedValue(baseTicket);
    });

    it('creates a reply message', async () => {
      const res = await request(app.getHttpServer())
        .post(`/admin/support/tickets/${TICKET_ID}/messages`)
        .send({ body: 'We are looking into this for you.' })
        .expect(201);

      expect(res.body.body).toBe('We are looking into this for you.');
      expect(res.body.authorType).toBe(TicketAuthorType.ADMIN);
    });

    it('rejects empty body', async () => {
      await request(app.getHttpServer())
        .post(`/admin/support/tickets/${TICKET_ID}/messages`)
        .send({ body: '' })
        .expect(400);
    });

    it('rejects missing body field', async () => {
      await request(app.getHttpServer())
        .post(`/admin/support/tickets/${TICKET_ID}/messages`)
        .send({})
        .expect(400);
    });
  });

  // ─── PATCH /admin/support/tickets/:ticketId ───────────────────────────────

  describe('PATCH /admin/support/tickets/:ticketId', () => {
    it('updates priority', async () => {
      ticketRepo.findOne
        .mockResolvedValueOnce(baseTicket)
        .mockResolvedValueOnce({ ...baseTicket, priority: TicketPriority.URGENT });

      const res = await request(app.getHttpServer())
        .patch(`/admin/support/tickets/${TICKET_ID}`)
        .send({ priority: TicketPriority.URGENT })
        .expect(200);

      expect(res.body.priority).toBe(TicketPriority.URGENT);
    });

    it('rejects unknown fields (whitelist)', async () => {
      await request(app.getHttpServer())
        .patch(`/admin/support/tickets/${TICKET_ID}`)
        .send({ unknownField: 'hack' })
        .expect(400);
    });
  });

  // ─── POST /admin/support/tickets/:ticketId/assign ─────────────────────────

  describe('POST /admin/support/tickets/:ticketId/assign', () => {
    it('assigns ticket to an admin', async () => {
      const assigneeId = 'assignee-admin-uuid';
      ticketRepo.findOne
        .mockResolvedValueOnce(baseTicket)
        .mockResolvedValueOnce({ ...baseTicket, assignedToId: assigneeId });
      userRepo.findOne.mockResolvedValueOnce({ id: assigneeId });

      const res = await request(app.getHttpServer())
        .post(`/admin/support/tickets/${TICKET_ID}/assign`)
        .send({ adminId: assigneeId })
        .expect(201);

      expect(res.body.assignedToId).toBe(assigneeId);
    });

    it('rejects non-UUID adminId', async () => {
      await request(app.getHttpServer())
        .post(`/admin/support/tickets/${TICKET_ID}/assign`)
        .send({ adminId: 'not-a-uuid' })
        .expect(400);
    });
  });

  // ─── POST /admin/support/tickets/:ticketId/resolve ────────────────────────

  describe('POST /admin/support/tickets/:ticketId/resolve', () => {
    it('resolves ticket with a resolution note', async () => {
      ticketRepo.findOne
        .mockResolvedValueOnce({ ...baseTicket, status: TicketStatus.IN_PROGRESS })
        .mockResolvedValueOnce({
          ...baseTicket,
          status: TicketStatus.RESOLVED,
          resolvedAt: new Date(),
        });

      const res = await request(app.getHttpServer())
        .post(`/admin/support/tickets/${TICKET_ID}/resolve`)
        .send({ resolutionNote: 'Issue was a known bug, patched in v2.3.' })
        .expect(201);

      expect(res.body.status).toBe(TicketStatus.RESOLVED);
    });

    it('rejects empty resolutionNote', async () => {
      await request(app.getHttpServer())
        .post(`/admin/support/tickets/${TICKET_ID}/resolve`)
        .send({ resolutionNote: '' })
        .expect(400);
    });

    it('rejects missing resolutionNote', async () => {
      await request(app.getHttpServer())
        .post(`/admin/support/tickets/${TICKET_ID}/resolve`)
        .send({})
        .expect(400);
    });
  });

  // ─── POST /admin/support/tickets/:ticketId/close ──────────────────────────

  describe('POST /admin/support/tickets/:ticketId/close', () => {
    it('closes a resolved ticket', async () => {
      ticketRepo.findOne
        .mockResolvedValueOnce({ ...baseTicket, status: TicketStatus.RESOLVED })
        .mockResolvedValueOnce({ ...baseTicket, status: TicketStatus.CLOSED });

      const res = await request(app.getHttpServer())
        .post(`/admin/support/tickets/${TICKET_ID}/close`)
        .expect(200);

      expect(res.body.status).toBe(TicketStatus.CLOSED);
    });

    it('returns 400 when ticket is not yet resolved', async () => {
      ticketRepo.findOne.mockResolvedValueOnce({
        ...baseTicket,
        status: TicketStatus.IN_PROGRESS,
      });

      await request(app.getHttpServer())
        .post(`/admin/support/tickets/${TICKET_ID}/close`)
        .expect(400);
    });
  });
});
