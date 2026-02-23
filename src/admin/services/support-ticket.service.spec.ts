import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { SupportTicketService } from './support-ticket.service';
import { SupportTicket } from '../entities/support-ticket.entity';
import { TicketMessage, TicketAuthorType } from '../entities/ticket-message.entity';
import { User } from '../../user/entities/user.entity';
import { Notification } from '../../notifications/entities/notification.entity';
import { AuditLogService } from './audit-log.service';
import { TicketStatus } from '../enums/ticket-status.enum';
import { TicketCategory } from '../enums/ticket-category.enum';
import { TicketPriority } from '../enums/ticket-priority.enum';

const ADMIN_ID = 'admin-uuid-001';
const USER_ID = 'user-uuid-001';
const TICKET_ID = 'ticket-uuid-001';

const mockTicket = (overrides: Partial<SupportTicket> = {}): SupportTicket =>
  ({
    id: TICKET_ID,
    userId: USER_ID,
    subject: 'Cannot log in',
    description: 'I get an error when I try to log in',
    category: TicketCategory.ACCOUNT,
    status: TicketStatus.OPEN,
    priority: TicketPriority.MEDIUM,
    assignedToId: null,
    assignedTo: null,
    resolvedAt: null,
    messages: [],
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
    ...overrides,
  } as SupportTicket);

describe('SupportTicketService', () => {
  let service: SupportTicketService;
  let ticketRepo: any;
  let messageRepo: any;
  let userRepo: any;
  let notificationRepo: any;
  let auditLogService: any;

  beforeEach(async () => {
    const qbMock = {
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
      update: jest.fn().mockReturnThis(),
      set: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      execute: jest.fn().mockResolvedValue({ affected: 0 }),
    };

    ticketRepo = {
      findOne: jest.fn(),
      update: jest.fn().mockResolvedValue({ affected: 1 }),
      createQueryBuilder: jest.fn().mockReturnValue(qbMock),
    };
    messageRepo = {
      create: jest.fn().mockImplementation((d) => d),
      save: jest.fn().mockImplementation((d) => Promise.resolve({ id: 'msg-uuid-1', ...d })),
    };
    userRepo = {
      findOne: jest.fn(),
    };
    notificationRepo = {
      create: jest.fn().mockImplementation((d) => d),
      save: jest.fn().mockResolvedValue({}),
    };
    auditLogService = {
      createAuditLog: jest.fn().mockResolvedValue({}),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SupportTicketService,
        { provide: getRepositoryToken(SupportTicket), useValue: ticketRepo },
        { provide: getRepositoryToken(TicketMessage), useValue: messageRepo },
        { provide: getRepositoryToken(User), useValue: userRepo },
        { provide: getRepositoryToken(Notification), useValue: notificationRepo },
        { provide: AuditLogService, useValue: auditLogService },
      ],
    }).compile();

    service = module.get<SupportTicketService>(SupportTicketService);
  });

  // ─── listTickets ──────────────────────────────────────────────────────────

  describe('listTickets', () => {
    it('returns paginated tickets with defaults', async () => {
      const tickets = [mockTicket()];
      const qb = ticketRepo.createQueryBuilder();
      qb.getManyAndCount.mockResolvedValue([tickets, 1]);

      const result = await service.listTickets({});

      expect(result.data).toEqual(tickets);
      expect(result.total).toBe(1);
      expect(result.page).toBe(1);
      expect(result.limit).toBe(20);
    });

    it('applies status filter', async () => {
      const qb = ticketRepo.createQueryBuilder();
      qb.getManyAndCount.mockResolvedValue([[], 0]);

      await service.listTickets({ status: TicketStatus.OPEN });

      expect(qb.andWhere).toHaveBeenCalledWith('t.status = :status', { status: TicketStatus.OPEN });
    });

    it('applies date range filter when both dates provided', async () => {
      const qb = ticketRepo.createQueryBuilder();
      qb.getManyAndCount.mockResolvedValue([[], 0]);

      await service.listTickets({ startDate: '2024-01-01', endDate: '2024-12-31' });

      expect(qb.andWhere).toHaveBeenCalledWith(
        't.createdAt BETWEEN :start AND :end',
        expect.objectContaining({ start: expect.any(Date), end: expect.any(Date) }),
      );
    });

    it('applies subject ILIKE search', async () => {
      const qb = ticketRepo.createQueryBuilder();
      qb.getManyAndCount.mockResolvedValue([[], 0]);

      await service.listTickets({ search: 'login' });

      expect(qb.andWhere).toHaveBeenCalledWith('t.subject ILIKE :search', {
        search: '%login%',
      });
    });
  });

  // ─── getTicket ────────────────────────────────────────────────────────────

  describe('getTicket', () => {
    it('returns ticket with messages sorted oldest-first', async () => {
      const msg1 = { id: 'm1', createdAt: new Date('2024-01-02') } as TicketMessage;
      const msg2 = { id: 'm2', createdAt: new Date('2024-01-01') } as TicketMessage;
      ticketRepo.findOne.mockResolvedValue(mockTicket({ messages: [msg1, msg2] }));

      const result = await service.getTicket(TICKET_ID);

      expect(result.messages[0].id).toBe('m2');
      expect(result.messages[1].id).toBe('m1');
    });

    it('throws NotFoundException for unknown ticket', async () => {
      ticketRepo.findOne.mockResolvedValue(null);

      await expect(service.getTicket('bad-id')).rejects.toThrow(NotFoundException);
    });
  });

  // ─── replyToTicket ────────────────────────────────────────────────────────

  describe('replyToTicket', () => {
    it('creates a message with ADMIN authorType', async () => {
      ticketRepo.findOne.mockResolvedValue(mockTicket());

      const result = await service.replyToTicket(TICKET_ID, ADMIN_ID, { body: 'Hello user' });

      expect(messageRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ authorType: TicketAuthorType.ADMIN, body: 'Hello user' }),
      );
      expect(result.id).toBeDefined();
    });

    it('moves OPEN ticket to IN_PROGRESS after admin reply', async () => {
      ticketRepo.findOne.mockResolvedValue(mockTicket({ status: TicketStatus.OPEN }));

      await service.replyToTicket(TICKET_ID, ADMIN_ID, { body: 'Working on it' });

      expect(ticketRepo.update).toHaveBeenCalledWith(TICKET_ID, {
        status: TicketStatus.IN_PROGRESS,
      });
    });

    it('does not change status when ticket is already IN_PROGRESS', async () => {
      ticketRepo.findOne.mockResolvedValue(mockTicket({ status: TicketStatus.IN_PROGRESS }));

      await service.replyToTicket(TICKET_ID, ADMIN_ID, { body: 'Still looking' });

      expect(ticketRepo.update).not.toHaveBeenCalled();
    });

    it('throws BadRequestException when ticket is CLOSED', async () => {
      ticketRepo.findOne.mockResolvedValue(mockTicket({ status: TicketStatus.CLOSED }));

      await expect(
        service.replyToTicket(TICKET_ID, ADMIN_ID, { body: 'Too late' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('sends an in-app notification to the user', async () => {
      ticketRepo.findOne.mockResolvedValue(mockTicket());

      await service.replyToTicket(TICKET_ID, ADMIN_ID, { body: 'Hi' });

      expect(notificationRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ recipientId: USER_ID }),
      );
      expect(notificationRepo.save).toHaveBeenCalledTimes(1);
    });
  });

  // ─── updateTicket ─────────────────────────────────────────────────────────

  describe('updateTicket', () => {
    it('updates priority without creating audit log if status unchanged', async () => {
      ticketRepo.findOne
        .mockResolvedValueOnce(mockTicket())
        .mockResolvedValueOnce(mockTicket({ priority: TicketPriority.HIGH }));

      await service.updateTicket(TICKET_ID, ADMIN_ID, { priority: TicketPriority.HIGH });

      expect(auditLogService.createAuditLog).not.toHaveBeenCalled();
    });

    it('creates audit log when status changes', async () => {
      ticketRepo.findOne
        .mockResolvedValueOnce(mockTicket({ status: TicketStatus.OPEN }))
        .mockResolvedValueOnce(mockTicket({ status: TicketStatus.IN_PROGRESS }));

      await service.updateTicket(TICKET_ID, ADMIN_ID, { status: TicketStatus.IN_PROGRESS });

      expect(auditLogService.createAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({ resourceId: TICKET_ID }),
      );
    });
  });

  // ─── assignTicket ─────────────────────────────────────────────────────────

  describe('assignTicket', () => {
    it('assigns ticket, sets IN_PROGRESS, notifies assignee', async () => {
      const assigneeId = 'admin-assignee-uuid';
      ticketRepo.findOne
        .mockResolvedValueOnce(mockTicket({ status: TicketStatus.OPEN }))
        .mockResolvedValueOnce(mockTicket({ assignedToId: assigneeId }));
      userRepo.findOne.mockResolvedValue({ id: assigneeId });

      await service.assignTicket(TICKET_ID, ADMIN_ID, { adminId: assigneeId });

      expect(ticketRepo.update).toHaveBeenCalledWith(TICKET_ID, {
        assignedToId: assigneeId,
        status: TicketStatus.IN_PROGRESS,
      });
      expect(auditLogService.createAuditLog).toHaveBeenCalledTimes(1);
      expect(notificationRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ recipientId: assigneeId }),
      );
    });

    it('throws NotFoundException when assignee user does not exist', async () => {
      ticketRepo.findOne.mockResolvedValue(mockTicket());
      userRepo.findOne.mockResolvedValue(null);

      await expect(
        service.assignTicket(TICKET_ID, ADMIN_ID, { adminId: 'bad-admin-id' }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ─── resolveTicket ────────────────────────────────────────────────────────

  describe('resolveTicket', () => {
    it('sets status to RESOLVED and records resolvedAt', async () => {
      ticketRepo.findOne
        .mockResolvedValueOnce(mockTicket({ status: TicketStatus.IN_PROGRESS }))
        .mockResolvedValueOnce(mockTicket({ status: TicketStatus.RESOLVED, resolvedAt: new Date() }));

      const result = await service.resolveTicket(TICKET_ID, ADMIN_ID, {
        resolutionNote: 'Reset password fixed it',
      });

      expect(ticketRepo.update).toHaveBeenCalledWith(
        TICKET_ID,
        expect.objectContaining({ status: TicketStatus.RESOLVED, resolvedAt: expect.any(Date) }),
      );
      expect(auditLogService.createAuditLog).toHaveBeenCalledTimes(1);
      expect(notificationRepo.save).toHaveBeenCalledTimes(1);
    });

    it('records resolution note as an admin message with [Resolution] prefix', async () => {
      ticketRepo.findOne
        .mockResolvedValueOnce(mockTicket({ status: TicketStatus.IN_PROGRESS }))
        .mockResolvedValueOnce(mockTicket({ status: TicketStatus.RESOLVED }));

      await service.resolveTicket(TICKET_ID, ADMIN_ID, { resolutionNote: 'Fixed' });

      expect(messageRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ body: '[Resolution] Fixed', authorType: TicketAuthorType.ADMIN }),
      );
    });

    it('throws BadRequestException when ticket is already RESOLVED', async () => {
      ticketRepo.findOne.mockResolvedValue(mockTicket({ status: TicketStatus.RESOLVED }));

      await expect(
        service.resolveTicket(TICKET_ID, ADMIN_ID, { resolutionNote: 'Again?' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException when ticket is CLOSED', async () => {
      ticketRepo.findOne.mockResolvedValue(mockTicket({ status: TicketStatus.CLOSED }));

      await expect(
        service.resolveTicket(TICKET_ID, ADMIN_ID, { resolutionNote: 'Nope' }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // ─── closeTicket ──────────────────────────────────────────────────────────

  describe('closeTicket', () => {
    it('closes a resolved ticket', async () => {
      ticketRepo.findOne
        .mockResolvedValueOnce(mockTicket({ status: TicketStatus.RESOLVED }))
        .mockResolvedValueOnce(mockTicket({ status: TicketStatus.CLOSED }));

      const result = await service.closeTicket(TICKET_ID);

      expect(ticketRepo.update).toHaveBeenCalledWith(TICKET_ID, { status: TicketStatus.CLOSED });
    });

    it('throws BadRequestException when ticket is not RESOLVED', async () => {
      ticketRepo.findOne.mockResolvedValue(mockTicket({ status: TicketStatus.IN_PROGRESS }));

      await expect(service.closeTicket(TICKET_ID)).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException when ticket is already CLOSED', async () => {
      ticketRepo.findOne.mockResolvedValue(mockTicket({ status: TicketStatus.CLOSED }));

      await expect(service.closeTicket(TICKET_ID)).rejects.toThrow(BadRequestException);
    });
  });

  // ─── autoCloseResolvedTickets ─────────────────────────────────────────────

  describe('autoCloseResolvedTickets', () => {
    it('bulk-updates resolved tickets older than 72h to CLOSED', async () => {
      const qb = ticketRepo.createQueryBuilder();
      qb.execute.mockResolvedValue({ affected: 3 });

      await service.autoCloseResolvedTickets();

      expect(qb.update).toHaveBeenCalledWith(SupportTicket);
      expect(qb.set).toHaveBeenCalledWith({ status: TicketStatus.CLOSED });
      expect(qb.where).toHaveBeenCalledWith('status = :status', {
        status: TicketStatus.RESOLVED,
      });
      expect(qb.andWhere).toHaveBeenCalledWith(
        'resolvedAt <= :cutoff',
        expect.objectContaining({ cutoff: expect.any(Date) }),
      );
    });
  });
});
