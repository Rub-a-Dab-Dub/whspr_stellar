import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import {
  SupportTicketAnalyticsService,
  SupportAnalyticsResult,
} from './support-ticket-analytics.service';
import { SupportTicket } from '../entities/support-ticket.entity';
import { TicketStatus } from '../enums/ticket-status.enum';
import { TicketCategory } from '../enums/ticket-category.enum';
import { TicketPriority } from '../enums/ticket-priority.enum';
import { AdminConfigService } from '../../config/admin-config.service';

const DEFAULT_SLA = {
  urgentHours: 2,
  highHours: 8,
  mediumHours: 24,
  lowHours: 72,
};

const mockAdminConfigService = {
  slaUrgentHours: DEFAULT_SLA.urgentHours,
  slaHighHours: DEFAULT_SLA.highHours,
  slaMediumHours: DEFAULT_SLA.mediumHours,
  slaLowHours: DEFAULT_SLA.lowHours,
};

/** Build a queryBuilder mock that returns the provided raw rows from each terminal method. */
function buildQb(rawOne: Record<string, any>, rawMany: any[] = []) {
  const qb: any = {
    select: jest.fn().mockReturnThis(),
    addSelect: jest.fn().mockReturnThis(),
    innerJoin: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    setParameters: jest.fn().mockReturnThis(),
    groupBy: jest.fn().mockReturnThis(),
    addGroupBy: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    getRawOne: jest.fn().mockResolvedValue(rawOne),
    getRawMany: jest.fn().mockResolvedValue(rawMany),
  };
  return qb;
}

describe('SupportTicketAnalyticsService', () => {
  let service: SupportTicketAnalyticsService;
  let ticketRepo: any;
  let qb: any;

  const summaryRow = {
    totalTickets: '320',
    openTickets: '45',
    avgResolutionTimeHours: '6.40',
    slaBreached: '12',
    statusOpen: '45',
    statusInProgress: '20',
    statusPendingUser: '0',
    statusResolved: '240',
    statusClosed: '15',
    catAccount: '80',
    catTransaction: '120',
    catTechnical: '70',
    catAbuse: '50',
    catOther: '0',
    priUrgent: '5',
    priHigh: '40',
    priMedium: '180',
    priLow: '95',
  };

  const assigneeRow = {
    adminId: 'admin-uuid-1',
    adminName: 'alice',
    assigned: '60',
    resolved: '55',
    avgResolutionTimeHours: '5.20',
  };

  const dailyRow = { date: '2024-01-01', count: '14' };

  beforeEach(async () => {
    qb = buildQb(summaryRow, [assigneeRow, dailyRow]);

    ticketRepo = {
      createQueryBuilder: jest.fn().mockReturnValue(qb),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SupportTicketAnalyticsService,
        { provide: getRepositoryToken(SupportTicket), useValue: ticketRepo },
        { provide: AdminConfigService, useValue: mockAdminConfigService },
      ],
    }).compile();

    service = module.get<SupportTicketAnalyticsService>(
      SupportTicketAnalyticsService,
    );
  });

  // ─── isSlaBreach ──────────────────────────────────────────────────────────

  describe('isSlaBreach', () => {
    const sla = DEFAULT_SLA;

    it('returns false for a resolved ticket regardless of age', () => {
      const old = new Date(Date.now() - 999 * 3_600_000);
      expect(
        service.isSlaBreach(TicketStatus.RESOLVED, TicketPriority.URGENT, old, sla),
      ).toBe(false);
    });

    it('returns false for a closed ticket regardless of age', () => {
      const old = new Date(Date.now() - 999 * 3_600_000);
      expect(
        service.isSlaBreach(TicketStatus.CLOSED, TicketPriority.URGENT, old, sla),
      ).toBe(false);
    });

    it('returns false for an open URGENT ticket within 2h SLA', () => {
      const oneHourAgo = new Date(Date.now() - 1 * 3_600_000);
      expect(
        service.isSlaBreach(TicketStatus.OPEN, TicketPriority.URGENT, oneHourAgo, sla),
      ).toBe(false);
    });

    it('returns true for an open URGENT ticket past 2h SLA', () => {
      const threeHoursAgo = new Date(Date.now() - 3 * 3_600_000);
      expect(
        service.isSlaBreach(TicketStatus.OPEN, TicketPriority.URGENT, threeHoursAgo, sla),
      ).toBe(true);
    });

    it('returns false for a HIGH ticket within 8h SLA', () => {
      const sevenHoursAgo = new Date(Date.now() - 7 * 3_600_000);
      expect(
        service.isSlaBreach(TicketStatus.OPEN, TicketPriority.HIGH, sevenHoursAgo, sla),
      ).toBe(false);
    });

    it('returns true for a HIGH ticket past 8h SLA', () => {
      const nineHoursAgo = new Date(Date.now() - 9 * 3_600_000);
      expect(
        service.isSlaBreach(TicketStatus.OPEN, TicketPriority.HIGH, nineHoursAgo, sla),
      ).toBe(true);
    });

    it('returns false for a MEDIUM ticket within 24h SLA', () => {
      const twentyHoursAgo = new Date(Date.now() - 20 * 3_600_000);
      expect(
        service.isSlaBreach(TicketStatus.IN_PROGRESS, TicketPriority.MEDIUM, twentyHoursAgo, sla),
      ).toBe(false);
    });

    it('returns true for a MEDIUM ticket past 24h SLA', () => {
      const twentyFiveHoursAgo = new Date(Date.now() - 25 * 3_600_000);
      expect(
        service.isSlaBreach(TicketStatus.IN_PROGRESS, TicketPriority.MEDIUM, twentyFiveHoursAgo, sla),
      ).toBe(true);
    });

    it('returns false for a LOW ticket within 72h SLA', () => {
      const sixtyHoursAgo = new Date(Date.now() - 60 * 3_600_000);
      expect(
        service.isSlaBreach(TicketStatus.PENDING_USER, TicketPriority.LOW, sixtyHoursAgo, sla),
      ).toBe(false);
    });

    it('returns true for a LOW ticket past 72h SLA', () => {
      const seventyThreeHoursAgo = new Date(Date.now() - 73 * 3_600_000);
      expect(
        service.isSlaBreach(TicketStatus.PENDING_USER, TicketPriority.LOW, seventyThreeHoursAgo, sla),
      ).toBe(true);
    });

    it('accepts a custom "now" for deterministic testing', () => {
      const fixedNow = new Date('2024-06-01T12:00:00Z');
      const createdAt = new Date('2024-06-01T09:30:00Z'); // 2.5h before fixedNow
      expect(
        service.isSlaBreach(TicketStatus.OPEN, TicketPriority.URGENT, createdAt, sla, fixedNow),
      ).toBe(true);
    });
  });

  // ─── slaHoursForPriority ──────────────────────────────────────────────────

  describe('slaHoursForPriority', () => {
    const sla = DEFAULT_SLA;

    it('returns 2 for URGENT', () => {
      expect(service.slaHoursForPriority(TicketPriority.URGENT, sla)).toBe(2);
    });

    it('returns 8 for HIGH', () => {
      expect(service.slaHoursForPriority(TicketPriority.HIGH, sla)).toBe(8);
    });

    it('returns 24 for MEDIUM', () => {
      expect(service.slaHoursForPriority(TicketPriority.MEDIUM, sla)).toBe(24);
    });

    it('returns 72 for LOW', () => {
      expect(service.slaHoursForPriority(TicketPriority.LOW, sla)).toBe(72);
    });

    it('reflects custom SLA values', () => {
      const customSla = { urgentHours: 1, highHours: 4, mediumHours: 12, lowHours: 48 };
      expect(service.slaHoursForPriority(TicketPriority.MEDIUM, customSla)).toBe(12);
    });
  });

  // ─── getAnalytics ─────────────────────────────────────────────────────────

  describe('getAnalytics', () => {
    it('returns the expected shape with correct numeric coercions', async () => {
      const result = await service.getAnalytics('30d');

      expect(result.totalTickets).toBe(320);
      expect(result.openTickets).toBe(45);
      expect(result.avgResolutionTimeHours).toBe(6.4);
      expect(result.slaBreached).toBe(12);
    });

    it('shapes byStatus correctly from raw counts', async () => {
      const result = await service.getAnalytics('30d');

      expect(result.byStatus[TicketStatus.OPEN]).toBe(45);
      expect(result.byStatus[TicketStatus.IN_PROGRESS]).toBe(20);
      expect(result.byStatus[TicketStatus.RESOLVED]).toBe(240);
      expect(result.byStatus[TicketStatus.CLOSED]).toBe(15);
    });

    it('shapes byCategory correctly', async () => {
      const result = await service.getAnalytics('30d');

      expect(result.byCategory[TicketCategory.TRANSACTION]).toBe(120);
      expect(result.byCategory[TicketCategory.ACCOUNT]).toBe(80);
    });

    it('shapes byPriority correctly', async () => {
      const result = await service.getAnalytics('30d');

      expect(result.byPriority[TicketPriority.URGENT]).toBe(5);
      expect(result.byPriority[TicketPriority.MEDIUM]).toBe(180);
    });

    it('includes period and since fields', async () => {
      const result = await service.getAnalytics('7d');

      expect(result.period).toBe('7d');
      expect(result.since).toBeDefined();
      // since should be ~7 days ago (within 5s margin)
      const sinceDate = new Date(result.since);
      const expectedSince = new Date(Date.now() - 7 * 24 * 3_600_000);
      expect(Math.abs(sinceDate.getTime() - expectedSince.getTime())).toBeLessThan(5000);
    });

    it('maps assignee row to AssigneeStats shape', async () => {
      const result = await service.getAnalytics('30d');

      expect(result.byAssignee[0]).toEqual({
        adminId: 'admin-uuid-1',
        adminName: 'alice',
        assigned: 60,
        resolved: 55,
        avgResolutionTimeHours: 5.2,
      });
    });

    it('maps daily row to ticketsPerDay shape', async () => {
      const result = await service.getAnalytics('30d');

      // getRawMany is called twice (assignee + daily) — last call returns dailyRow
      expect(result.ticketsPerDay).toContainEqual({ date: '2024-01-01', count: 14 });
    });

    it('handles zero / null avgResolutionTimeHours gracefully', async () => {
      qb.getRawOne.mockResolvedValueOnce({
        ...summaryRow,
        avgResolutionTimeHours: null,
      });

      const result = await service.getAnalytics('30d');
      expect(result.avgResolutionTimeHours).toBe(0);
    });

    it('defaults to 30d when no period provided', async () => {
      const result = await service.getAnalytics();

      expect(result.period).toBe('30d');
    });

    it('uses distinct "since" windows for different periods', async () => {
      const r7 = await service.getAnalytics('7d');
      const r90 = await service.getAnalytics('90d');

      const since7 = new Date(r7.since).getTime();
      const since90 = new Date(r90.since).getTime();
      // 90d window should be further in the past than 7d window
      expect(since90).toBeLessThan(since7);
    });
  });
});
