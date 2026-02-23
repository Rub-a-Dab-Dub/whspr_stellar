import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, MoreThanOrEqual, LessThanOrEqual } from 'typeorm';
import { Cron, CronExpression } from '@nestjs/schedule';
import type { Request } from 'express';

import { SupportTicket } from '../entities/support-ticket.entity';
import {
  TicketMessage,
  TicketAuthorType,
} from '../entities/ticket-message.entity';
import { User } from '../../user/entities/user.entity';
import { Notification } from '../../notifications/entities/notification.entity';
import { AuditLogService } from './audit-log.service';
import {
  AuditAction,
  AuditEventType,
  AuditOutcome,
  AuditSeverity,
} from '../entities/audit-log.entity';
import { TicketStatus } from '../enums/ticket-status.enum';
import { TicketPriority } from '../enums/ticket-priority.enum';
import { ListTicketsDto } from '../dto/support-ticket/list-tickets.dto';
import { UpdateTicketDto } from '../dto/support-ticket/update-ticket.dto';
import { ReplyTicketDto } from '../dto/support-ticket/reply-ticket.dto';
import { AssignTicketDto } from '../dto/support-ticket/assign-ticket.dto';
import { ResolveTicketDto } from '../dto/support-ticket/resolve-ticket.dto';
import {
  NotificationType,
  NotificationPriority,
} from '../../notifications/enums/notification-type.enum';

const AUTO_CLOSE_HOURS = 72;

@Injectable()
export class SupportTicketService {
  private readonly logger = new Logger(SupportTicketService.name);

  constructor(
    @InjectRepository(SupportTicket)
    private readonly ticketRepository: Repository<SupportTicket>,
    @InjectRepository(TicketMessage)
    private readonly messageRepository: Repository<TicketMessage>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(Notification)
    private readonly notificationRepository: Repository<Notification>,
    private readonly auditLogService: AuditLogService,
  ) {}

  // ─── List ────────────────────────────────────────────────────────────────

  async listTickets(dto: ListTicketsDto): Promise<{
    data: SupportTicket[];
    total: number;
    page: number;
    limit: number;
  }> {
    const page = dto.page ?? 1;
    const limit = dto.limit ?? 20;
    const skip = (page - 1) * limit;

    const qb = this.ticketRepository
      .createQueryBuilder('t')
      .leftJoinAndSelect('t.user', 'user')
      .leftJoinAndSelect('t.assignedTo', 'assignedTo')
      .orderBy('t.createdAt', 'DESC')
      .skip(skip)
      .take(limit);

    if (dto.status) {
      qb.andWhere('t.status = :status', { status: dto.status });
    }
    if (dto.priority) {
      qb.andWhere('t.priority = :priority', { priority: dto.priority });
    }
    if (dto.category) {
      qb.andWhere('t.category = :category', { category: dto.category });
    }
    if (dto.assignedTo) {
      qb.andWhere('t.assignedToId = :assignedTo', { assignedTo: dto.assignedTo });
    }
    if (dto.userId) {
      qb.andWhere('t.userId = :userId', { userId: dto.userId });
    }
    if (dto.search) {
      qb.andWhere('t.subject ILIKE :search', { search: `%${dto.search}%` });
    }
    if (dto.startDate && dto.endDate) {
      qb.andWhere('t.createdAt BETWEEN :start AND :end', {
        start: new Date(dto.startDate),
        end: new Date(dto.endDate),
      });
    } else if (dto.startDate) {
      qb.andWhere('t.createdAt >= :start', { start: new Date(dto.startDate) });
    } else if (dto.endDate) {
      qb.andWhere('t.createdAt <= :end', { end: new Date(dto.endDate) });
    }

    const [data, total] = await qb.getManyAndCount();
    return { data, total, page, limit };
  }

  // ─── Get single ──────────────────────────────────────────────────────────

  async getTicket(ticketId: string): Promise<SupportTicket> {
    const ticket = await this.ticketRepository.findOne({
      where: { id: ticketId },
      relations: ['user', 'assignedTo', 'messages'],
    });

    if (!ticket) {
      throw new NotFoundException(`Ticket ${ticketId} not found`);
    }

    // Sort messages oldest-first
    ticket.messages?.sort(
      (a, b) => a.createdAt.getTime() - b.createdAt.getTime(),
    );

    return ticket;
  }

  // ─── Reply ───────────────────────────────────────────────────────────────

  async replyToTicket(
    ticketId: string,
    adminId: string,
    dto: ReplyTicketDto,
  ): Promise<TicketMessage> {
    const ticket = await this.findTicketOrFail(ticketId);

    if (ticket.status === TicketStatus.CLOSED) {
      throw new BadRequestException('Cannot reply to a closed ticket');
    }

    const message = this.messageRepository.create({
      ticketId,
      authorId: adminId,
      authorType: TicketAuthorType.ADMIN,
      body: dto.body,
    });

    const saved = await this.messageRepository.save(message);

    // Move ticket to in_progress if still open
    if (ticket.status === TicketStatus.OPEN) {
      await this.ticketRepository.update(ticketId, {
        status: TicketStatus.IN_PROGRESS,
      });
    }

    // Notify the user
    await this.sendNotification(
      ticket.userId,
      'Support ticket update',
      `An admin has replied to your support ticket: "${ticket.subject}"`,
      { ticketId },
      NotificationPriority.NORMAL,
    );

    return saved;
  }

  // ─── Update metadata ────────────────────────────────────────────────────

  async updateTicket(
    ticketId: string,
    adminId: string,
    dto: UpdateTicketDto,
    req?: Request,
  ): Promise<SupportTicket> {
    const ticket = await this.findTicketOrFail(ticketId);
    const previousStatus = ticket.status;

    const updates: Partial<SupportTicket> = {};
    if (dto.status !== undefined) updates.status = dto.status;
    if (dto.priority !== undefined) updates.priority = dto.priority;
    if (dto.category !== undefined) updates.category = dto.category;
    if (dto.assignedTo !== undefined) updates.assignedToId = dto.assignedTo ?? null;

    await this.ticketRepository.update(ticketId, updates);

    if (dto.status && dto.status !== previousStatus) {
      await this.auditLogService.createAuditLog({
        actorUserId: adminId,
        targetUserId: ticket.userId,
        action: AuditAction.TICKET_STATUS_CHANGED,
        eventType: AuditEventType.ADMIN,
        outcome: AuditOutcome.SUCCESS,
        severity: AuditSeverity.LOW,
        resourceType: 'support_ticket',
        resourceId: ticketId,
        details: `Status changed from ${previousStatus} to ${dto.status}`,
        req,
      });
    }

    return this.getTicket(ticketId);
  }

  // ─── Assign ──────────────────────────────────────────────────────────────

  async assignTicket(
    ticketId: string,
    actorAdminId: string,
    dto: AssignTicketDto,
    req?: Request,
  ): Promise<SupportTicket> {
    const ticket = await this.findTicketOrFail(ticketId);

    const assignee = await this.userRepository.findOne({
      where: { id: dto.adminId },
    });
    if (!assignee) {
      throw new NotFoundException(`Admin user ${dto.adminId} not found`);
    }

    await this.ticketRepository.update(ticketId, {
      assignedToId: dto.adminId,
      status:
        ticket.status === TicketStatus.OPEN
          ? TicketStatus.IN_PROGRESS
          : ticket.status,
    });

    await this.auditLogService.createAuditLog({
      actorUserId: actorAdminId,
      targetUserId: ticket.userId,
      action: AuditAction.TICKET_ASSIGNED,
      eventType: AuditEventType.ADMIN,
      outcome: AuditOutcome.SUCCESS,
      severity: AuditSeverity.LOW,
      resourceType: 'support_ticket',
      resourceId: ticketId,
      details: `Ticket assigned to admin ${dto.adminId}`,
      req,
    });

    // Notify the assignee
    await this.sendNotification(
      dto.adminId,
      'Support ticket assigned to you',
      `You have been assigned ticket: "${ticket.subject}"`,
      { ticketId },
      NotificationPriority.HIGH,
    );

    return this.getTicket(ticketId);
  }

  // ─── Resolve ─────────────────────────────────────────────────────────────

  async resolveTicket(
    ticketId: string,
    adminId: string,
    dto: ResolveTicketDto,
    req?: Request,
  ): Promise<SupportTicket> {
    const ticket = await this.findTicketOrFail(ticketId);

    if (ticket.status === TicketStatus.CLOSED) {
      throw new BadRequestException('Ticket is already closed');
    }
    if (ticket.status === TicketStatus.RESOLVED) {
      throw new BadRequestException('Ticket is already resolved');
    }

    const now = new Date();
    await this.ticketRepository.update(ticketId, {
      status: TicketStatus.RESOLVED,
      resolvedAt: now,
    });

    // Record resolution note as an admin message
    const message = this.messageRepository.create({
      ticketId,
      authorId: adminId,
      authorType: TicketAuthorType.ADMIN,
      body: `[Resolution] ${dto.resolutionNote}`,
    });
    await this.messageRepository.save(message);

    await this.auditLogService.createAuditLog({
      actorUserId: adminId,
      targetUserId: ticket.userId,
      action: AuditAction.TICKET_RESOLVED,
      eventType: AuditEventType.ADMIN,
      outcome: AuditOutcome.SUCCESS,
      severity: AuditSeverity.LOW,
      resourceType: 'support_ticket',
      resourceId: ticketId,
      details: dto.resolutionNote,
      req,
    });

    // Notify the user
    await this.sendNotification(
      ticket.userId,
      'Your support ticket has been resolved',
      `Your ticket "${ticket.subject}" has been resolved. If the issue persists you can reopen it within 72 hours.`,
      { ticketId },
      NotificationPriority.NORMAL,
    );

    return this.getTicket(ticketId);
  }

  // ─── Close ───────────────────────────────────────────────────────────────

  async closeTicket(ticketId: string): Promise<SupportTicket> {
    const ticket = await this.findTicketOrFail(ticketId);

    if (ticket.status === TicketStatus.CLOSED) {
      throw new BadRequestException('Ticket is already closed');
    }
    if (ticket.status !== TicketStatus.RESOLVED) {
      throw new BadRequestException(
        'Only resolved tickets can be closed. Resolve the ticket first.',
      );
    }

    await this.ticketRepository.update(ticketId, {
      status: TicketStatus.CLOSED,
    });

    return this.getTicket(ticketId);
  }

  // ─── Auto-close job ──────────────────────────────────────────────────────

  @Cron(CronExpression.EVERY_HOUR)
  async autoCloseResolvedTickets(): Promise<void> {
    const cutoff = new Date(Date.now() - AUTO_CLOSE_HOURS * 60 * 60 * 1000);

    const result = await this.ticketRepository
      .createQueryBuilder()
      .update(SupportTicket)
      .set({ status: TicketStatus.CLOSED })
      .where('status = :status', { status: TicketStatus.RESOLVED })
      .andWhere('resolvedAt <= :cutoff', { cutoff })
      .execute();

    if (result.affected && result.affected > 0) {
      this.logger.log(`Auto-closed ${result.affected} ticket(s) after ${AUTO_CLOSE_HOURS}h`);
    }
  }

  // ─── Private helpers ─────────────────────────────────────────────────────

  private async findTicketOrFail(ticketId: string): Promise<SupportTicket> {
    const ticket = await this.ticketRepository.findOne({
      where: { id: ticketId },
    });
    if (!ticket) {
      throw new NotFoundException(`Ticket ${ticketId} not found`);
    }
    return ticket;
  }

  private async sendNotification(
    recipientId: string,
    title: string,
    message: string,
    data: Record<string, any>,
    priority: NotificationPriority,
  ): Promise<void> {
    try {
      const notification = this.notificationRepository.create({
        recipientId,
        senderId: null,
        type: NotificationType.SYSTEM,
        title,
        message,
        data,
        priority,
      });
      await this.notificationRepository.save(notification);
    } catch (err) {
      this.logger.error('Failed to send support ticket notification', err);
    }
  }
}
