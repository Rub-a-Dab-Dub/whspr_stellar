import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SupportTicket } from '../entities/support-ticket.entity';
import { TicketStatus } from '../enums/ticket-status.enum';
import { TicketCategory } from '../enums/ticket-category.enum';
import { TicketPriority } from '../enums/ticket-priority.enum';
import { AdminConfigService } from '../../config/admin-config.service';
import { AnalyticsPeriod } from '../dto/support-ticket/get-analytics.dto';

const PERIOD_DAYS: Record<AnalyticsPeriod, number> = {
  '7d': 7,
  '14d': 14,
  '30d': 30,
  '90d': 90,
  '365d': 365,
};

export interface AssigneeStats {
  adminId: string;
  adminName: string;
  assigned: number;
  resolved: number;
  avgResolutionTimeHours: number;
}

export interface SupportAnalyticsResult {
  period: string;
  since: string;
  totalTickets: number;
  openTickets: number;
  avgResolutionTimeHours: number;
  slaBreached: number;
  byStatus: Record<string, number>;
  byCategory: Record<string, number>;
  byPriority: Record<string, number>;
  byAssignee: AssigneeStats[];
  ticketsPerDay: { date: string; count: number }[];
}

const UNRESOLVED_STATUSES = [
  TicketStatus.OPEN,
  TicketStatus.IN_PROGRESS,
  TicketStatus.PENDING_USER,
];

@Injectable()
export class SupportTicketAnalyticsService {
  constructor(
    @InjectRepository(SupportTicket)
    private readonly ticketRepository: Repository<SupportTicket>,
    private readonly adminConfigService: AdminConfigService,
  ) {}

  async getAnalytics(
    period: AnalyticsPeriod = '30d',
  ): Promise<SupportAnalyticsResult> {
    const days = PERIOD_DAYS[period];
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const sla = {
      urgentHours: this.adminConfigService.slaUrgentHours,
      highHours: this.adminConfigService.slaHighHours,
      mediumHours: this.adminConfigService.slaMediumHours,
      lowHours: this.adminConfigService.slaLowHours,
    };

    const [summary, assigneeRows, dailyRows] = await Promise.all([
      this.querySummary(since, sla),
      this.queryByAssignee(since),
      this.queryTicketsPerDay(since),
    ]);

    return {
      period,
      since: since.toISOString(),
      ...summary,
      byAssignee: assigneeRows,
      ticketsPerDay: dailyRows,
    };
  }

  // ─── Helpers (exposed for unit testing) ──────────────────────────────────

  /** Compute the SLA threshold hours for a given priority. */
  slaHoursForPriority(
    priority: TicketPriority,
    sla: { urgentHours: number; highHours: number; mediumHours: number; lowHours: number },
  ): number {
    switch (priority) {
      case TicketPriority.URGENT: return sla.urgentHours;
      case TicketPriority.HIGH: return sla.highHours;
      case TicketPriority.MEDIUM: return sla.mediumHours;
      case TicketPriority.LOW: return sla.lowHours;
    }
  }

  /** Determine if a ticket is SLA-breached (pure, testable). */
  isSlaBreach(
    status: TicketStatus,
    priority: TicketPriority,
    createdAt: Date,
    sla: { urgentHours: number; highHours: number; mediumHours: number; lowHours: number },
    now = new Date(),
  ): boolean {
    if (!UNRESOLVED_STATUSES.includes(status)) return false;
    const ageHours = (now.getTime() - createdAt.getTime()) / 3_600_000;
    return ageHours > this.slaHoursForPriority(priority, sla);
  }

  // ─── Private query helpers ────────────────────────────────────────────────

  private async querySummary(
    since: Date,
    sla: { urgentHours: number; highHours: number; mediumHours: number; lowHours: number },
  ) {
    const row: any = await this.ticketRepository
      .createQueryBuilder('t')
      .select('COUNT(*)', 'totalTickets')
      .addSelect(
        `COUNT(*) FILTER (WHERE t.status IN (:...unresolved))`,
        'openTickets',
      )
      .addSelect(
        `ROUND(
           AVG(
             EXTRACT(EPOCH FROM (t."resolvedAt" - t."createdAt")) / 3600.0
           ) FILTER (WHERE t."resolvedAt" IS NOT NULL)
         , 2)`,
        'avgResolutionTimeHours',
      )
      // SLA breach: unresolved AND age in hours exceeds priority threshold
      .addSelect(
        `COUNT(*) FILTER (
           WHERE t.status IN (:...unresolved)
             AND EXTRACT(EPOCH FROM (NOW() - t."createdAt")) / 3600.0 >
               CASE t.priority
                 WHEN 'urgent' THEN :urgentHours
                 WHEN 'high'   THEN :highHours
                 WHEN 'medium' THEN :mediumHours
                 ELSE :lowHours
               END
         )`,
        'slaBreached',
      )
      // byStatus breakdown
      .addSelect(`COUNT(*) FILTER (WHERE t.status = 'open')`, 'statusOpen')
      .addSelect(`COUNT(*) FILTER (WHERE t.status = 'in_progress')`, 'statusInProgress')
      .addSelect(`COUNT(*) FILTER (WHERE t.status = 'pending_user')`, 'statusPendingUser')
      .addSelect(`COUNT(*) FILTER (WHERE t.status = 'resolved')`, 'statusResolved')
      .addSelect(`COUNT(*) FILTER (WHERE t.status = 'closed')`, 'statusClosed')
      // byCategory breakdown
      .addSelect(`COUNT(*) FILTER (WHERE t.category = 'account')`, 'catAccount')
      .addSelect(`COUNT(*) FILTER (WHERE t.category = 'transaction')`, 'catTransaction')
      .addSelect(`COUNT(*) FILTER (WHERE t.category = 'technical')`, 'catTechnical')
      .addSelect(`COUNT(*) FILTER (WHERE t.category = 'abuse')`, 'catAbuse')
      .addSelect(`COUNT(*) FILTER (WHERE t.category = 'other')`, 'catOther')
      // byPriority breakdown
      .addSelect(`COUNT(*) FILTER (WHERE t.priority = 'urgent')`, 'priUrgent')
      .addSelect(`COUNT(*) FILTER (WHERE t.priority = 'high')`, 'priHigh')
      .addSelect(`COUNT(*) FILTER (WHERE t.priority = 'medium')`, 'priMedium')
      .addSelect(`COUNT(*) FILTER (WHERE t.priority = 'low')`, 'priLow')
      .where('t."createdAt" >= :since', { since })
      .setParameters({
        unresolved: UNRESOLVED_STATUSES,
        urgentHours: sla.urgentHours,
        highHours: sla.highHours,
        mediumHours: sla.mediumHours,
        lowHours: sla.lowHours,
      })
      .getRawOne();

    return {
      totalTickets: Number(row.totalTickets ?? 0),
      openTickets: Number(row.openTickets ?? 0),
      avgResolutionTimeHours: parseFloat(row.avgResolutionTimeHours ?? '0') || 0,
      slaBreached: Number(row.slaBreached ?? 0),
      byStatus: {
        [TicketStatus.OPEN]: Number(row.statusOpen ?? 0),
        [TicketStatus.IN_PROGRESS]: Number(row.statusInProgress ?? 0),
        [TicketStatus.PENDING_USER]: Number(row.statusPendingUser ?? 0),
        [TicketStatus.RESOLVED]: Number(row.statusResolved ?? 0),
        [TicketStatus.CLOSED]: Number(row.statusClosed ?? 0),
      },
      byCategory: {
        [TicketCategory.ACCOUNT]: Number(row.catAccount ?? 0),
        [TicketCategory.TRANSACTION]: Number(row.catTransaction ?? 0),
        [TicketCategory.TECHNICAL]: Number(row.catTechnical ?? 0),
        [TicketCategory.ABUSE]: Number(row.catAbuse ?? 0),
        [TicketCategory.OTHER]: Number(row.catOther ?? 0),
      },
      byPriority: {
        [TicketPriority.URGENT]: Number(row.priUrgent ?? 0),
        [TicketPriority.HIGH]: Number(row.priHigh ?? 0),
        [TicketPriority.MEDIUM]: Number(row.priMedium ?? 0),
        [TicketPriority.LOW]: Number(row.priLow ?? 0),
      },
    };
  }

  private async queryByAssignee(since: Date): Promise<AssigneeStats[]> {
    const rows: any[] = await this.ticketRepository
      .createQueryBuilder('t')
      .innerJoin('users', 'u', 'u.id = t."assignedToId"::uuid')
      .select('t."assignedToId"', 'adminId')
      .addSelect(`COALESCE(u.username, u.email, 'Unknown')`, 'adminName')
      .addSelect('COUNT(*)', 'assigned')
      .addSelect(
        `COUNT(*) FILTER (WHERE t."resolvedAt" IS NOT NULL)`,
        'resolved',
      )
      .addSelect(
        `ROUND(
           AVG(
             EXTRACT(EPOCH FROM (t."resolvedAt" - t."createdAt")) / 3600.0
           ) FILTER (WHERE t."resolvedAt" IS NOT NULL)
         , 2)`,
        'avgResolutionTimeHours',
      )
      .where('t."createdAt" >= :since', { since })
      .andWhere('t."assignedToId" IS NOT NULL')
      .groupBy('t."assignedToId"')
      .addGroupBy('u.username')
      .addGroupBy('u.email')
      .orderBy('COUNT(*)', 'DESC')
      .getRawMany();

    return rows.map((r) => ({
      adminId: r.adminId,
      adminName: r.adminName,
      assigned: Number(r.assigned),
      resolved: Number(r.resolved),
      avgResolutionTimeHours: parseFloat(r.avgResolutionTimeHours ?? '0') || 0,
    }));
  }

  private async queryTicketsPerDay(
    since: Date,
  ): Promise<{ date: string; count: number }[]> {
    const rows: any[] = await this.ticketRepository
      .createQueryBuilder('t')
      .select(`DATE(t."createdAt")`, 'date')
      .addSelect('COUNT(*)', 'count')
      .where('t."createdAt" >= :since', { since })
      .groupBy(`DATE(t."createdAt")`)
      .orderBy('date', 'ASC')
      .getRawMany();

    return rows.map((r) => ({
      date: r.date instanceof Date
        ? r.date.toISOString().slice(0, 10)
        : String(r.date),
      count: Number(r.count),
    }));
  }
}
