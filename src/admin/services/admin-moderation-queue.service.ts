import {
    Injectable,
    Logger,
    NotFoundException,
    BadRequestException,
    ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, MoreThanOrEqual, LessThanOrEqual } from 'typeorm';
import { Cron, CronExpression } from '@nestjs/schedule';
import type { Request } from 'express';

import {
    ModerationQueue,
    ModerationDecision,
    ModerationAppeal,
    ModerationTemplate,
    ModeratorMetrics,
    ModerationAnalytics,
    ModerationStatus,
    ModerationAction,
    PriorityLevel,
    ContentType,
    ReportReason,
    AppealStatus,
} from '../../moderation/moderation-queue.entity';
import { User } from '../../user/entities/user.entity';
import {
    AuditLogService,
} from './audit-log.service';
import {
    AuditAction,
    AuditEventType,
    AuditOutcome,
    AuditSeverity,
} from '../entities/audit-log.entity';
import {
    ModerationQueueFilterDto,
    AssignModeratorDto,
    ModerationActionDto,
    BatchModerationActionDto,
    SubmitAppealDto,
    ReviewAppealDto,
    EscalateDto,
    CreateModerationTemplateDto,
    AppealFilterDto,
    ModeratorMetricsFilterDto,
    ModerationAnalyticsFilterDto,
} from '../dto/admin-moderation-queue.dto';

// ─── Priority score map (lower = higher priority) ─────────────────────────────
const PRIORITY_ORDER: Record<PriorityLevel, number> = {
    [PriorityLevel.CRITICAL]: 1,
    [PriorityLevel.HIGH]: 2,
    [PriorityLevel.MEDIUM]: 3,
    [PriorityLevel.LOW]: 4,
};

// ─── Auto-flag confidence → priority ─────────────────────────────────────────
function derivePriority(confidence?: number): PriorityLevel {
    if (confidence === undefined) return PriorityLevel.MEDIUM;
    if (confidence >= 0.9) return PriorityLevel.CRITICAL;
    if (confidence >= 0.7) return PriorityLevel.HIGH;
    if (confidence >= 0.4) return PriorityLevel.MEDIUM;
    return PriorityLevel.LOW;
}

@Injectable()
export class AdminModerationQueueService {
    private readonly logger = new Logger(AdminModerationQueueService.name);

    constructor(
        @InjectRepository(ModerationQueue)
        private readonly queueRepo: Repository<ModerationQueue>,
        @InjectRepository(ModerationDecision)
        private readonly decisionRepo: Repository<ModerationDecision>,
        @InjectRepository(ModerationAppeal)
        private readonly appealRepo: Repository<ModerationAppeal>,
        @InjectRepository(ModerationTemplate)
        private readonly templateRepo: Repository<ModerationTemplate>,
        @InjectRepository(ModeratorMetrics)
        private readonly metricsRepo: Repository<ModeratorMetrics>,
        @InjectRepository(ModerationAnalytics)
        private readonly analyticsRepo: Repository<ModerationAnalytics>,
        @InjectRepository(User)
        private readonly userRepo: Repository<User>,
        private readonly auditLogService: AuditLogService,
    ) { }

    // ─── Queue listing ────────────────────────────────────────────────────────

    async getQueue(
        dto: ModerationQueueFilterDto,
        adminId: string,
        req?: Request,
    ): Promise<{
        data: any[];
        total: number;
        page: number;
        limit: number;
    }> {
        const page = dto.page ?? 1;
        const limit = dto.limit ?? 50;
        const skip = (page - 1) * limit;

        const qb = this.queueRepo
            .createQueryBuilder('q')
            .skip(skip)
            .take(limit);

        if (dto.status) qb.andWhere('q.status = :status', { status: dto.status });
        if (dto.priority) qb.andWhere('q.priority = :priority', { priority: dto.priority });
        if (dto.contentType) qb.andWhere('q.contentType = :ct', { ct: dto.contentType });
        if (dto.assignedModeratorId) qb.andWhere('q.assignedModeratorId = :mod', { mod: dto.assignedModeratorId });
        if (dto.isAutoFlagged !== undefined) qb.andWhere('q.isAutoFlagged = :flag', { flag: dto.isAutoFlagged });

        // Sort – priority uses CASE ordering, everything else is direct
        if (dto.sortBy === 'priority') {
            qb.orderBy(
                `CASE q.priority
          WHEN '${PriorityLevel.CRITICAL}' THEN 1
          WHEN '${PriorityLevel.HIGH}' THEN 2
          WHEN '${PriorityLevel.MEDIUM}' THEN 3
          WHEN '${PriorityLevel.LOW}' THEN 4
          ELSE 5
        END`,
                dto.sortOrder ?? 'ASC',
            );
        } else {
            qb.orderBy(`q.${dto.sortBy ?? 'createdAt'}`, dto.sortOrder ?? 'DESC');
        }

        const [items, total] = await qb.getManyAndCount();

        const now = Date.now();
        const data = items.map((item) => ({
            ...item,
            timeInQueue: Math.floor((now - item.createdAt.getTime()) / 1000),
        }));

        await this.auditLogService.createAuditLog({
            actorUserId: adminId,
            action: AuditAction.USER_VIEWED,
            eventType: AuditEventType.ADMIN,
            outcome: AuditOutcome.SUCCESS,
            severity: AuditSeverity.LOW,
            resourceType: 'moderation_queue',
            details: `Viewed moderation queue (${data.length} items)`,
            req,
        });

        return { data, total, page, limit };
    }

    // ─── Assign moderator ─────────────────────────────────────────────────────

    async assignModerator(
        itemId: string,
        dto: AssignModeratorDto,
        adminId: string,
        req?: Request,
    ): Promise<ModerationQueue> {
        const item = await this.findQueueItemOrFail(itemId);

        const moderator = await this.userRepo.findOne({ where: { id: dto.moderatorId } });
        if (!moderator) {
            throw new NotFoundException(`Moderator ${dto.moderatorId} not found`);
        }

        item.assignedModeratorId = dto.moderatorId;
        item.assignedAt = new Date();
        if (item.status === ModerationStatus.PENDING) {
            item.status = ModerationStatus.IN_REVIEW;
        }
        const saved = await this.queueRepo.save(item);

        await this.auditLogService.createAuditLog({
            actorUserId: adminId,
            action: AuditAction.USER_UPDATED,
            eventType: AuditEventType.ADMIN,
            outcome: AuditOutcome.SUCCESS,
            severity: AuditSeverity.LOW,
            resourceType: 'moderation_queue',
            resourceId: itemId,
            details: `Assigned moderator ${dto.moderatorId} to queue item ${itemId}`,
            req,
        });

        return saved;
    }

    // ─── Take moderation action ───────────────────────────────────────────────

    async takeAction(
        itemId: string,
        dto: ModerationActionDto,
        moderatorId: string,
        req?: Request,
    ): Promise<ModerationDecision> {
        const item = await this.findQueueItemOrFail(itemId);

        if (
            item.status === ModerationStatus.APPROVED ||
            item.status === ModerationStatus.REMOVED
        ) {
            throw new BadRequestException('Queue item is already resolved');
        }

        const startTime = item.assignedAt ? item.assignedAt.getTime() : item.createdAt.getTime();
        const processingTimeSeconds = Math.floor((Date.now() - startTime) / 1000);

        // Build decision
        const decision = this.decisionRepo.create({
            queueItemId: itemId,
            moderatorId,
            action: dto.action,
            reason: dto.reason,
            internalNotes: dto.internalNotes,
            actionMetadata: dto.actionMetadata,
            isEscalated: dto.action === ModerationAction.ESCALATE,
            escalatedToModeratorId:
                dto.action === ModerationAction.ESCALATE ? dto.escalateToModeratorId : null,
            processingTimeSeconds,
        });
        const savedDecision = await this.decisionRepo.save(decision);

        // Update queue item status
        const statusMap: Partial<Record<ModerationAction, ModerationStatus>> = {
            [ModerationAction.APPROVE]: ModerationStatus.APPROVED,
            [ModerationAction.REMOVE]: ModerationStatus.REMOVED,
            [ModerationAction.WARN]: ModerationStatus.WARNED,
            [ModerationAction.ESCALATE]: ModerationStatus.ESCALATED,
        };
        const newStatus = statusMap[dto.action];
        if (newStatus) {
            item.status = newStatus;
        }
        item.reviewedAt = new Date();
        if (newStatus && newStatus !== ModerationStatus.IN_REVIEW) {
            item.resolvedAt = new Date();
        }
        await this.queueRepo.save(item);

        // Update daily metrics
        await this.updateDailyMetrics(moderatorId, dto.action, processingTimeSeconds);

        await this.auditLogService.createAuditLog({
            actorUserId: moderatorId,
            action: AuditAction.USER_UPDATED,
            eventType: AuditEventType.ADMIN,
            outcome: AuditOutcome.SUCCESS,
            severity: AuditSeverity.MEDIUM,
            resourceType: 'moderation_queue',
            resourceId: itemId,
            details: `Moderation action '${dto.action}' taken on item ${itemId}`,
            metadata: { action: dto.action, reason: dto.reason },
            req,
        });

        return savedDecision;
    }

    // ─── Batch moderation ─────────────────────────────────────────────────────

    async batchAction(
        dto: BatchModerationActionDto,
        moderatorId: string,
        req?: Request,
    ): Promise<{ success: string[]; failed: Array<{ id: string; error: string }> }> {
        const results = await Promise.allSettled(
            dto.queueItemIds.map((itemId) =>
                this.takeAction(
                    itemId,
                    {
                        action: dto.action,
                        reason: dto.reason,
                        actionMetadata: dto.templateId ? { templateId: dto.templateId } : undefined,
                    },
                    moderatorId,
                    req,
                ),
            ),
        );

        const success: string[] = [];
        const failed: Array<{ id: string; error: string }> = [];

        results.forEach((result, idx) => {
            if (result.status === 'fulfilled') {
                success.push(dto.queueItemIds[idx]);
            } else {
                failed.push({
                    id: dto.queueItemIds[idx],
                    error: result.reason?.message ?? 'Unknown error',
                });
            }
        });

        this.logger.log(
            `Batch moderation: ${success.length} succeeded, ${failed.length} failed`,
        );

        return { success, failed };
    }

    // ─── Auto-flag content ────────────────────────────────────────────────────

    async autoFlagContent(data: {
        contentType: ContentType;
        contentId: string;
        reportedUserId: string;
        reporterId: string;
        reason: ReportReason;
        description?: string;
        autoFlagMetadata?: {
            confidence?: number;
            flaggedKeywords?: string[];
            aiScore?: number;
            riskFactors?: string[];
        };
        contentSnapshot?: {
            text?: string;
            imageUrl?: string;
            metadata?: any;
        };
    }): Promise<ModerationQueue> {
        // Check for existing pending item for this content
        const existing = await this.queueRepo.findOne({
            where: {
                contentType: data.contentType,
                contentId: data.contentId,
                status: ModerationStatus.PENDING,
            },
        });

        if (existing) {
            // Increment report count and merge metadata
            existing.reportCount += 1;
            // Re-derive priority based on report count escalation
            if (existing.reportCount >= 10) existing.priority = PriorityLevel.CRITICAL;
            else if (existing.reportCount >= 5) existing.priority = PriorityLevel.HIGH;
            return await this.queueRepo.save(existing);
        }

        const priority = derivePriority(data.autoFlagMetadata?.confidence);

        const item = this.queueRepo.create({
            contentType: data.contentType,
            contentId: data.contentId,
            reportedUserId: data.reportedUserId,
            reporterId: data.reporterId,
            reason: data.reason,
            description: data.description,
            isAutoFlagged: true,
            priority,
            status: ModerationStatus.PENDING,
            autoFlagMetadata: data.autoFlagMetadata,
            contentSnapshot: data.contentSnapshot,
        });

        return await this.queueRepo.save(item);
    }

    // ─── Submit appeal ────────────────────────────────────────────────────────

    async submitAppeal(
        itemId: string,
        dto: SubmitAppealDto,
        appealerId: string,
    ): Promise<ModerationAppeal> {
        const item = await this.findQueueItemOrFail(itemId);

        if (
            item.status !== ModerationStatus.REMOVED &&
            item.status !== ModerationStatus.WARNED
        ) {
            throw new BadRequestException(
                'Appeals can only be submitted for removed or warned content',
            );
        }

        // Check for existing pending appeal
        const existingAppeal = await this.appealRepo.findOne({
            where: { queueItemId: itemId, status: AppealStatus.PENDING },
        });
        if (existingAppeal) {
            throw new BadRequestException('An appeal is already pending for this item');
        }

        const appeal = this.appealRepo.create({
            queueItemId: itemId,
            appealerId,
            appealReason: dto.appealReason,
            evidence: dto.evidence,
            status: AppealStatus.PENDING,
        });
        const saved = await this.appealRepo.save(appeal);

        item.status = ModerationStatus.APPEALED;
        await this.queueRepo.save(item);

        return saved;
    }

    // ─── Review appeal ────────────────────────────────────────────────────────

    async reviewAppeal(
        appealId: string,
        dto: ReviewAppealDto,
        moderatorId: string,
        req?: Request,
    ): Promise<ModerationAppeal> {
        const appeal = await this.appealRepo.findOne({
            where: { id: appealId },
        });
        if (!appeal) throw new NotFoundException(`Appeal ${appealId} not found`);

        if (appeal.status !== AppealStatus.PENDING && appeal.status !== AppealStatus.UNDER_REVIEW) {
            throw new BadRequestException('Appeal is already resolved');
        }

        appeal.status =
            dto.decision === 'approve' ? AppealStatus.APPROVED : AppealStatus.REJECTED;
        appeal.reviewedByModeratorId = moderatorId;
        appeal.reviewNotes = dto.reviewNotes;
        appeal.reviewedAt = new Date();
        const saved = await this.appealRepo.save(appeal);

        // If approved: restore the content → mark queue item status back to APPROVED
        if (dto.decision === 'approve') {
            const item = await this.queueRepo.findOne({ where: { id: appeal.queueItemId } });
            if (item) {
                item.status = ModerationStatus.APPROVED;
                await this.queueRepo.save(item);
            }
            // Update moderator's appeal-overturned metric (affects the original moderator)
            if (item) {
                const originalDecision = await this.decisionRepo.findOne({
                    where: { queueItemId: item.id },
                    order: { createdAt: 'ASC' },
                });
                if (originalDecision) {
                    await this.incrementMetricField(
                        originalDecision.moderatorId,
                        'appealsOverturned',
                    );
                }
            }
        }

        // Increment appeals-received for original moderator
        const originalDecision = await this.decisionRepo.findOne({
            where: { queueItemId: appeal.queueItemId },
            order: { createdAt: 'ASC' },
        });
        if (originalDecision) {
            await this.incrementMetricField(originalDecision.moderatorId, 'appealsReceived');
        }

        await this.auditLogService.createAuditLog({
            actorUserId: moderatorId,
            action: AuditAction.USER_UPDATED,
            eventType: AuditEventType.ADMIN,
            outcome: AuditOutcome.SUCCESS,
            severity: AuditSeverity.MEDIUM,
            resourceType: 'moderation_appeal',
            resourceId: appealId,
            details: `Appeal ${dto.decision}d by moderator ${moderatorId}`,
            req,
        });

        return saved;
    }

    // ─── List appeals ─────────────────────────────────────────────────────────

    async getAppeals(
        dto: AppealFilterDto,
        adminId: string,
        req?: Request,
    ): Promise<{ data: ModerationAppeal[]; total: number; page: number; limit: number }> {
        const page = dto.page ?? 1;
        const limit = dto.limit ?? 20;
        const skip = (page - 1) * limit;

        const qb = this.appealRepo
            .createQueryBuilder('a')
            .orderBy('a.createdAt', 'DESC')
            .skip(skip)
            .take(limit);

        if (dto.status) qb.andWhere('a.status = :status', { status: dto.status });

        const [data, total] = await qb.getManyAndCount();
        return { data, total, page, limit };
    }

    // ─── Escalate to senior moderator ─────────────────────────────────────────

    async escalateToSenior(
        itemId: string,
        dto: EscalateDto,
        moderatorId: string,
        req?: Request,
    ): Promise<ModerationDecision> {
        const item = await this.findQueueItemOrFail(itemId);

        const seniorMod = await this.userRepo.findOne({
            where: { id: dto.escalateToModeratorId },
        });
        if (!seniorMod) {
            throw new NotFoundException(`Senior moderator ${dto.escalateToModeratorId} not found`);
        }

        const decision = this.decisionRepo.create({
            queueItemId: itemId,
            moderatorId,
            action: ModerationAction.ESCALATE,
            reason: dto.reason,
            isEscalated: true,
            escalatedToModeratorId: dto.escalateToModeratorId,
        });
        const savedDecision = await this.decisionRepo.save(decision);

        item.status = ModerationStatus.ESCALATED;
        item.assignedModeratorId = dto.escalateToModeratorId;
        item.assignedAt = new Date();
        await this.queueRepo.save(item);

        await this.updateDailyMetrics(moderatorId, ModerationAction.ESCALATE, 0);

        await this.auditLogService.createAuditLog({
            actorUserId: moderatorId,
            action: AuditAction.USER_UPDATED,
            eventType: AuditEventType.ADMIN,
            outcome: AuditOutcome.SUCCESS,
            severity: AuditSeverity.HIGH,
            resourceType: 'moderation_queue',
            resourceId: itemId,
            details: `Escalated item ${itemId} to senior moderator ${dto.escalateToModeratorId}`,
            req,
        });

        return savedDecision;
    }

    // ─── Templates ────────────────────────────────────────────────────────────

    async getTemplates(): Promise<ModerationTemplate[]> {
        return this.templateRepo.find({
            where: { isActive: true },
            order: { createdAt: 'DESC' },
        });
    }

    async createTemplate(
        dto: CreateModerationTemplateDto,
        adminId: string,
        req?: Request,
    ): Promise<ModerationTemplate> {
        const template = this.templateRepo.create({
            name: dto.name,
            action: dto.action,
            messageTemplate: dto.messageTemplate,
            internalNotesTemplate: dto.internalNotesTemplate,
            defaultSettings: dto.defaultSettings,
            isActive: true,
        });
        const saved = await this.templateRepo.save(template);

        await this.auditLogService.createAuditLog({
            actorUserId: adminId,
            action: AuditAction.USER_UPDATED,
            eventType: AuditEventType.ADMIN,
            outcome: AuditOutcome.SUCCESS,
            severity: AuditSeverity.LOW,
            resourceType: 'moderation_template',
            resourceId: saved.id,
            details: `Created moderation template '${dto.name}'`,
            req,
        });

        return saved;
    }

    // ─── Moderator metrics ────────────────────────────────────────────────────

    async getModeratorMetrics(
        dto: ModeratorMetricsFilterDto,
    ): Promise<{ data: ModeratorMetrics[]; total: number }> {
        const qb = this.metricsRepo.createQueryBuilder('m').orderBy('m.date', 'DESC');

        if (dto.moderatorId) qb.andWhere('m.moderatorId = :mid', { mid: dto.moderatorId });
        if (dto.dateFrom) qb.andWhere('m.date >= :from', { from: dto.dateFrom });
        if (dto.dateTo) qb.andWhere('m.date <= :to', { to: dto.dateTo });

        const [data, total] = await qb.getManyAndCount();

        // Compute appeal overturn rates
        const enriched = data.map((m) => ({
            ...m,
            appealOverturnRate:
                m.appealsReceived > 0
                    ? Math.round((m.appealsOverturned / m.appealsReceived) * 10000) / 100
                    : 0,
        }));

        return { data: enriched as any, total };
    }

    // ─── Analytics ────────────────────────────────────────────────────────────

    async getModerationAnalytics(
        dto: ModerationAnalyticsFilterDto,
    ): Promise<{ data: ModerationAnalytics[]; summary: any }> {
        const qb = this.analyticsRepo.createQueryBuilder('a').orderBy('a.date', 'DESC');

        if (dto.dateFrom) qb.andWhere('a.date >= :from', { from: dto.dateFrom });
        if (dto.dateTo) qb.andWhere('a.date <= :to', { to: dto.dateTo });

        const data = await qb.getMany();

        // Aggregate summary totals
        const summary = data.reduce(
            (acc, row) => {
                acc.totalReports += row.totalReports;
                acc.autoFlagged += row.autoFlagged;
                acc.userReported += row.userReported;
                acc.resolved += row.resolvedCount;
                acc.pending += row.pendingCount;
                return acc;
            },
            { totalReports: 0, autoFlagged: 0, userReported: 0, resolved: 0, pending: 0 },
        );

        return { data, summary };
    }

    // ─── Daily metrics aggregation (cron) ────────────────────────────────────

    @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
    async aggregateDailyAnalytics(): Promise<void> {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const [totalReports, autoFlagged, pending, resolved] = await Promise.all([
            this.queueRepo.count({ where: { createdAt: MoreThanOrEqual(today) as any } }),
            this.queueRepo.count({ where: { createdAt: MoreThanOrEqual(today) as any, isAutoFlagged: true } }),
            this.queueRepo.count({ where: { status: ModerationStatus.PENDING } }),
            this.queueRepo.count({ where: { resolvedAt: MoreThanOrEqual(today) as any } }),
        ]);

        const existing = await this.analyticsRepo.findOne({ where: { date: today as any } });

        if (existing) {
            existing.totalReports = totalReports;
            existing.autoFlagged = autoFlagged;
            existing.userReported = totalReports - autoFlagged;
            existing.pendingCount = pending;
            existing.resolvedCount = resolved;
            await this.analyticsRepo.save(existing);
        } else {
            await this.analyticsRepo.save(
                this.analyticsRepo.create({
                    date: today as any,
                    totalReports,
                    autoFlagged,
                    userReported: totalReports - autoFlagged,
                    pendingCount: pending,
                    resolvedCount: resolved,
                    reportsByReason: {} as any,
                    reportsByContentType: {} as any,
                }),
            );
        }

        this.logger.log(`Daily moderation analytics aggregated for ${today.toDateString()}`);
    }

    // ─── Private helpers ──────────────────────────────────────────────────────

    private async findQueueItemOrFail(itemId: string): Promise<ModerationQueue> {
        const item = await this.queueRepo.findOne({ where: { id: itemId } });
        if (!item) throw new NotFoundException(`Queue item ${itemId} not found`);
        return item;
    }

    async updateDailyMetrics(
        moderatorId: string,
        action: ModerationAction,
        processingSeconds: number,
    ): Promise<void> {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        let metrics = await this.metricsRepo.findOne({
            where: { moderatorId, date: today as any },
        });

        if (!metrics) {
            metrics = this.metricsRepo.create({
                moderatorId,
                date: today as any,
            });
        }

        metrics.totalReviewed += 1;

        switch (action) {
            case ModerationAction.APPROVE:
                metrics.approved += 1;
                break;
            case ModerationAction.REMOVE:
                metrics.removed += 1;
                break;
            case ModerationAction.WARN:
                metrics.warned += 1;
                break;
            case ModerationAction.ESCALATE:
                metrics.escalated += 1;
                break;
        }

        // Rolling average processing time
        if (processingSeconds > 0) {
            metrics.averageProcessingTimeSeconds = Math.round(
                (metrics.averageProcessingTimeSeconds * (metrics.totalReviewed - 1) + processingSeconds) /
                metrics.totalReviewed,
            );
        }

        await this.metricsRepo.save(metrics);
    }

    private async incrementMetricField(
        moderatorId: string,
        field: 'appealsReceived' | 'appealsOverturned',
    ): Promise<void> {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        let metrics = await this.metricsRepo.findOne({
            where: { moderatorId, date: today as any },
        });

        if (!metrics) {
            metrics = this.metricsRepo.create({ moderatorId, date: today as any });
        }

        metrics[field] += 1;

        // Recalculate accuracy rate
        if (metrics.appealsReceived > 0) {
            const overturnRate = metrics.appealsOverturned / metrics.appealsReceived;
            metrics.accuracyRate = Math.round((1 - overturnRate) * 10000) / 100;
        }

        await this.metricsRepo.save(metrics);
    }
}
