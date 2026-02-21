
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  ManyToOne,
  JoinColumn,
  OneToMany,
} from 'typeorm';

export enum ContentType {
  MESSAGE = 'message',
  POST = 'post',
  COMMENT = 'comment',
  PROFILE = 'profile',
  ROOM = 'room',
  IMAGE = 'image',
  VIDEO = 'video',
}

export enum ReportReason {
  SPAM = 'spam',
  HARASSMENT = 'harassment',
  HATE_SPEECH = 'hate_speech',
  VIOLENCE = 'violence',
  NSFW = 'nsfw',
  MISINFORMATION = 'misinformation',
  COPYRIGHT = 'copyright',
  IMPERSONATION = 'impersonation',
  SELF_HARM = 'self_harm',
  ILLEGAL_CONTENT = 'illegal_content',
  OTHER = 'other',
}

export enum ModerationStatus {
  PENDING = 'pending',
  IN_REVIEW = 'in_review',
  APPROVED = 'approved',
  REMOVED = 'removed',
  WARNED = 'warned',
  ESCALATED = 'escalated',
  APPEALED = 'appealed',
}

export enum ModerationAction {
  APPROVE = 'approve',
  REMOVE = 'remove',
  WARN = 'warn',
  BAN_USER = 'ban_user',
  ESCALATE = 'escalate',
  REQUEST_INFO = 'request_info',
}

export enum PriorityLevel {
  CRITICAL = 'critical', // 1-2 hours
  HIGH = 'high',         // 4-8 hours
  MEDIUM = 'medium',     // 24 hours
  LOW = 'low',           // 48+ hours
}

export enum AppealStatus {
  PENDING = 'pending',
  UNDER_REVIEW = 'under_review',
  APPROVED = 'approved',
  REJECTED = 'rejected',
}

@Entity('moderation_queue')
@Index(['status', 'priority'])
@Index(['assignedModeratorId', 'status'])
@Index(['contentType', 'contentId'])
@Index(['createdAt'])
export class ModerationQueue {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'enum', enum: ContentType })
  contentType: ContentType;

  @Column({ type: 'uuid' })
  contentId: string;

  @Column({ type: 'uuid' })
  reportedUserId: string;

  @Column({ type: 'uuid' })
  reporterId: string;

  @Column({ type: 'enum', enum: ReportReason })
  reason: ReportReason;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ type: 'enum', enum: ModerationStatus, default: ModerationStatus.PENDING })
  status: ModerationStatus;

  @Column({ type: 'enum', enum: PriorityLevel, default: PriorityLevel.MEDIUM })
  priority: PriorityLevel;

  @Column({ type: 'uuid', nullable: true })
  assignedModeratorId: string;

  @Column({ type: 'timestamp', nullable: true })
  assignedAt: Date;

  @Column({ type: 'jsonb', nullable: true })
  contentSnapshot: {
    text?: string;
    imageUrl?: string;
    metadata?: any;
  };

  @Column({ type: 'jsonb', nullable: true })
  autoFlagMetadata: {
    confidence?: number;
    flaggedKeywords?: string[];
    aiScore?: number;
    riskFactors?: string[];
  };

  @Column({ type: 'boolean', default: false })
  isAutoFlagged: boolean;

  @Column({ type: 'integer', default: 1 })
  reportCount: number;

  @Column({ type: 'timestamp', nullable: true })
  reviewedAt: Date;

  @Column({ type: 'timestamp', nullable: true })
  resolvedAt: Date;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @OneToMany(() => ModerationDecision, decision => decision.queueItem)
  decisions: ModerationDecision[];

  @OneToMany(() => ModerationAppeal, appeal => appeal.queueItem)
  appeals: ModerationAppeal[];
}

@Entity('moderation_decisions')
@Index(['queueItemId'])
@Index(['moderatorId'])
export class ModerationDecision {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  queueItemId: string;

  @ManyToOne(() => ModerationQueue, queue => queue.decisions)
  @JoinColumn({ name: 'queueItemId' })
  queueItem: ModerationQueue;

  @Column({ type: 'uuid' })
  moderatorId: string;

  @Column({ type: 'enum', enum: ModerationAction })
  action: ModerationAction;

  @Column({ type: 'text', nullable: true })
  reason: string;

  @Column({ type: 'text', nullable: true })
  internalNotes: string;

  @Column({ type: 'jsonb', nullable: true })
  actionMetadata: {
    banDuration?: number;
    warningLevel?: number;
    templateId?: string;
    customMessage?: string;
  };

  @Column({ type: 'boolean', default: false })
  isEscalated: boolean;

  @Column({ type: 'uuid', nullable: true })
  escalatedToModeratorId: string;

  @Column({ type: 'integer', nullable: true })
  processingTimeSeconds: number;

  @CreateDateColumn()
  createdAt: Date;
}

@Entity('moderation_appeals')
@Index(['queueItemId'])
@Index(['status'])
export class ModerationAppeal {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  queueItemId: string;

  @ManyToOne(() => ModerationQueue, queue => queue.appeals)
  @JoinColumn({ name: 'queueItemId' })
  queueItem: ModerationQueue;

  @Column({ type: 'uuid' })
  appealerId: string;

  @Column({ type: 'text' })
  appealReason: string;

  @Column({ type: 'jsonb', nullable: true })
  evidence: {
    text?: string;
    urls?: string[];
    attachments?: string[];
  };

  @Column({ type: 'enum', enum: AppealStatus, default: AppealStatus.PENDING })
  status: AppealStatus;

  @Column({ type: 'uuid', nullable: true })
  reviewedByModeratorId: string;

  @Column({ type: 'text', nullable: true })
  reviewNotes: string;

  @Column({ type: 'timestamp', nullable: true })
  reviewedAt: Date;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

@Entity('moderation_templates')
export class ModerationTemplate {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 200 })
  name: string;

  @Column({ type: 'enum', enum: ModerationAction })
  action: ModerationAction;

  @Column({ type: 'text' })
  messageTemplate: string;

  @Column({ type: 'text', nullable: true })
  internalNotesTemplate: string;

  @Column({ type: 'jsonb', nullable: true })
  defaultSettings: {
    banDuration?: number;
    warningLevel?: number;
  };

  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

@Entity('moderator_metrics')
@Index(['moderatorId', 'date'])
export class ModeratorMetrics {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  moderatorId: string;

  @Column({ type: 'date' })
  date: Date;

  @Column({ type: 'integer', default: 0 })
  totalReviewed: number;

  @Column({ type: 'integer', default: 0 })
  approved: number;

  @Column({ type: 'integer', default: 0 })
  removed: number;

  @Column({ type: 'integer', default: 0 })
  warned: number;

  @Column({ type: 'integer', default: 0 })
  escalated: number;

  @Column({ type: 'integer', default: 0 })
  averageProcessingTimeSeconds: number;

  @Column({ type: 'decimal', precision: 5, scale: 2, default: 0 })
  accuracyRate: number;

  @Column({ type: 'integer', default: 0 })
  appealsReceived: number;

  @Column({ type: 'integer', default: 0 })
  appealsOverturned: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

@Entity('moderation_analytics')
export class ModerationAnalytics {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'date' })
  date: Date;

  @Column({ type: 'integer', default: 0 })
  totalReports: number;

  @Column({ type: 'integer', default: 0 })
  autoFlagged: number;

  @Column({ type: 'integer', default: 0 })
  userReported: number;

  @Column({ type: 'jsonb' })
  reportsByReason: Record<ReportReason, number>;

  @Column({ type: 'jsonb' })
  reportsByContentType: Record<ContentType, number>;

  @Column({ type: 'integer', default: 0 })
  averageQueueTime: number;

  @Column({ type: 'integer', default: 0 })
  pendingCount: number;

  @Column({ type: 'integer', default: 0 })
  resolvedCount: number;

  @CreateDateColumn()
  createdAt: Date;
}

// ============================================================================
// DTOs
// ============================================================================

export class CreateReportDto {
  contentType: ContentType;
  contentId: string;
  reportedUserId: string;
  reason: ReportReason;
  description?: string;
}

export class ModerationQueueFilterDto {
  status?: ModerationStatus;
  priority?: PriorityLevel;
  contentType?: ContentType;
  assignedModeratorId?: string;
  isAutoFlagged?: boolean;
  page?: number = 1;
  limit?: number = 50;
  sortBy?: 'createdAt' | 'priority' | 'reportCount' = 'createdAt';
  sortOrder?: 'ASC' | 'DESC' = 'DESC';
}

export class ModerationActionDto {
  action: ModerationAction;
  reason?: string;
  internalNotes?: string;
  actionMetadata?: {
    banDuration?: number;
    warningLevel?: number;
    templateId?: string;
    customMessage?: string;
  };
  escalateToModeratorId?: string;
}

export class BatchModerationDto {
  queueItemIds: string[];
  action: ModerationAction;
  reason?: string;
  templateId?: string;
}

export class CreateAppealDto {
  queueItemId: string;
  appealReason: string;
  evidence?: {
    text?: string;
    urls?: string[];
    attachments?: string[];
  };
}

export class ModerationQueueItemDto {
  id: string;
  contentType: ContentType;
  contentId: string;
  reportedUserId: string;
  reporterId: string;
  reason: ReportReason;
  description: string;
  status: ModerationStatus;
  priority: PriorityLevel;
  assignedModeratorId?: string;
  contentSnapshot: any;
  isAutoFlagged: boolean;
  reportCount: number;
  createdAt: Date;
  assignedAt?: Date;
  timeInQueue?: number;
}

export class ModeratorPerformanceDto {
  moderatorId: string;
  totalReviewed: number;
  actionBreakdown: {
    approved: number;
    removed: number;
    warned: number;
    escalated: number;
  };
  averageProcessingTime: number;
  accuracyRate: number;
  appealsReceived: number;
  appealsOverturned: number;
  appealOverturnRate: number;
}

// ============================================================================
// AUTO-FLAGGING SERVICE
// ============================================================================

import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between } from 'typeorm';

@Injectable()
export class AutoFlaggingService {
  private readonly logger = new Logger(AutoFlaggingService.name);

  // Keyword lists for auto-flagging
  private readonly SPAM_KEYWORDS = [
    'buy now', 'click here', 'limited time', 'act now', 'free money',
    'make money fast', 'work from home', 'casino', 'viagra'
  ];

  private readonly HARASSMENT_KEYWORDS = [
    'kill yourself', 'kys', 'die', 'worthless', 'pathetic'
  ];

  private readonly HATE_SPEECH_KEYWORDS = [
    // Add appropriate keywords based on your content policy
  ];

  constructor(
    @InjectRepository(ModerationQueue)
    private queueRepo: Repository<ModerationQueue>,
  ) {}

  /**
   * Analyze content and auto-flag if necessary
   */
  async analyzeContent(
    contentType: ContentType,
    contentId: string,
    content: string,
    userId: string,
    metadata?: any
  ): Promise<void> {
    const analysis = await this.runContentAnalysis(content, metadata);

    if (analysis.shouldFlag) {
      await this.createAutoFlag(
        contentType,
        contentId,
        userId,
        analysis
      );
    }
  }

  /**
   * Run content analysis
   */
  private async runContentAnalysis(
    content: string,
    metadata?: any
  ): Promise<{
    shouldFlag: boolean;
    reason: ReportReason;
    priority: PriorityLevel;
    confidence: number;
    flaggedKeywords: string[];
    riskFactors: string[];
  }> {
    const contentLower = content.toLowerCase();
    const flaggedKeywords: string[] = [];
    const riskFactors: string[] = [];
    let reason = ReportReason.OTHER;
    let priority = PriorityLevel.LOW;
    let confidence = 0;

    // Check for spam
    const spamMatches = this.SPAM_KEYWORDS.filter(keyword => 
      contentLower.includes(keyword.toLowerCase())
    );
    if (spamMatches.length > 0) {
      flaggedKeywords.push(...spamMatches);
      reason = ReportReason.SPAM;
      confidence += spamMatches.length * 0.2;
      riskFactors.push('spam_keywords_detected');
    }

    // Check for harassment
    const harassmentMatches = this.HARASSMENT_KEYWORDS.filter(keyword => 
      contentLower.includes(keyword.toLowerCase())
    );
    if (harassmentMatches.length > 0) {
      flaggedKeywords.push(...harassmentMatches);
      reason = ReportReason.HARASSMENT;
      confidence += harassmentMatches.length * 0.3;
      priority = PriorityLevel.HIGH;
      riskFactors.push('harassment_language_detected');
    }

    // Check content length and repetition
    if (content.length > 500 && this.hasExcessiveRepetition(content)) {
      confidence += 0.2;
      riskFactors.push('excessive_repetition');
    }

    // Check for excessive caps
    const capsRatio = this.calculateCapsRatio(content);
    if (capsRatio > 0.7 && content.length > 20) {
      confidence += 0.15;
      riskFactors.push('excessive_caps');
    }

    // Check for URL spam
    const urlCount = (content.match(/https?:\/\//g) || []).length;
    if (urlCount > 3) {
      confidence += 0.2;
      riskFactors.push('excessive_urls');
    }

    // Determine if should flag (confidence threshold)
    const shouldFlag = confidence >= 0.5;

    // Adjust priority based on confidence
    if (confidence >= 0.9) {
      priority = PriorityLevel.CRITICAL;
    } else if (confidence >= 0.7) {
      priority = PriorityLevel.HIGH;
    } else if (confidence >= 0.5) {
      priority = PriorityLevel.MEDIUM;
    }

    return {
      shouldFlag,
      reason,
      priority,
      confidence: Math.min(confidence, 1),
      flaggedKeywords,
      riskFactors,
    };
  }

  /**
   * Create auto-flagged item in moderation queue
   */
  private async createAutoFlag(
    contentType: ContentType,
    contentId: string,
    userId: string,
    analysis: any
  ): Promise<void> {
    const queueItem = this.queueRepo.create({
      contentType,
      contentId,
      reportedUserId: userId,
      reporterId: 'system',
      reason: analysis.reason,
      description: 'Auto-flagged by content analysis system',
      status: ModerationStatus.PENDING,
      priority: analysis.priority,
      isAutoFlagged: true,
      autoFlagMetadata: {
        confidence: analysis.confidence,
        flaggedKeywords: analysis.flaggedKeywords,
        riskFactors: analysis.riskFactors,
      },
    });

    await this.queueRepo.save(queueItem);

    this.logger.warn(
      `Auto-flagged content: ${contentType}:${contentId} - ${analysis.reason} (confidence: ${analysis.confidence})`
    );
  }

  /**
   * Check for excessive repetition
   */
  private hasExcessiveRepetition(content: string): boolean {
    const words = content.split(/\s+/);
    const wordCount = new Map<string, number>();

    for (const word of words) {
      const normalized = word.toLowerCase();
      wordCount.set(normalized, (wordCount.get(normalized) || 0) + 1);
    }

    // Check if any word appears more than 30% of total words
    const maxCount = Math.max(...wordCount.values());
    return maxCount / words.length > 0.3;
  }

  /**
   * Calculate caps ratio
   */
  private calculateCapsRatio(content: string): number {
    const letters = content.replace(/[^a-zA-Z]/g, '');
    if (letters.length === 0) return 0;

    const caps = content.replace(/[^A-Z]/g, '');
    return caps.length / letters.length;
  }
}

// ============================================================================
// MODERATION QUEUE SERVICE
// ============================================================================

@Injectable()
export class ModerationQueueService {
  private readonly logger = new Logger(ModerationQueueService.name);

  constructor(
    @InjectRepository(ModerationQueue)
    private queueRepo: Repository<ModerationQueue>,
    @InjectRepository(ModerationDecision)
    private decisionRepo: Repository<ModerationDecision>,
    @InjectRepository(ModerationAppeal)
    private appealRepo: Repository<ModerationAppeal>,
    @InjectRepository(ModeratorMetrics)
    private metricsRepo: Repository<ModeratorMetrics>,
    private autoFlaggingService: AutoFlaggingService,
  ) {}

  /**
   * Create a new report
   */
  async createReport(
    dto: CreateReportDto,
    reporterId: string,
    contentSnapshot?: any
  ): Promise<ModerationQueue> {
    // Check if already reported
    let existing = await this.queueRepo.findOne({
      where: {
        contentType: dto.contentType,
        contentId: dto.contentId,
        status: ModerationStatus.PENDING,
      },
    });

    if (existing) {
      // Increment report count
      existing.reportCount += 1;
      
      // Upgrade priority if multiple reports
      if (existing.reportCount >= 5 && existing.priority !== PriorityLevel.CRITICAL) {
        existing.priority = PriorityLevel.HIGH;
      }
      
      return await this.queueRepo.save(existing);
    }

    // Create new queue item
    const queueItem = this.queueRepo.create({
      ...dto,
      reporterId,
      contentSnapshot,
      status: ModerationStatus.PENDING,
      priority: this.determinePriority(dto.reason),
    });

    return await this.queueRepo.save(queueItem);
  }

  /**
   * Get moderation queue with filters
   */
  async getQueue(
    filters: ModerationQueueFilterDto
  ): Promise<{
    items: ModerationQueueItemDto[];
    total: number;
    page: number;
    totalPages: number;
  }> {
    const { page = 1, limit = 50, sortBy = 'createdAt', sortOrder = 'DESC' } = filters;
    const skip = (page - 1) * limit;

    const queryBuilder = this.queueRepo.createQueryBuilder('queue');

    // Apply filters
    if (filters.status) {
      queryBuilder.andWhere('queue.status = :status', { status: filters.status });
    }
    if (filters.priority) {
      queryBuilder.andWhere('queue.priority = :priority', { priority: filters.priority });
    }
    if (filters.contentType) {
      queryBuilder.andWhere('queue.contentType = :contentType', { contentType: filters.contentType });
    }
    if (filters.assignedModeratorId) {
      queryBuilder.andWhere('queue.assignedModeratorId = :moderatorId', { 
        moderatorId: filters.assignedModeratorId 
      });
    }
    if (filters.isAutoFlagged !== undefined) {
      queryBuilder.andWhere('queue.isAutoFlagged = :isAutoFlagged', { 
        isAutoFlagged: filters.isAutoFlagged 
      });
    }

    // Apply sorting
    const orderMap = {
      createdAt: 'queue.createdAt',
      priority: 'queue.priority',
      reportCount: 'queue.reportCount',
    };

    queryBuilder.orderBy(orderMap[sortBy] || 'queue.createdAt', sortOrder);

    // Get total count
    const total = await queryBuilder.getCount();

    // Apply pagination
    queryBuilder.skip(skip).take(limit);

    const items = await queryBuilder.getMany();

    return {
      items: items.map(item => this.mapToDto(item)),
      total,
      page,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Assign moderator to queue item
   */
  async assignModerator(
    queueItemId: string,
    moderatorId: string
  ): Promise<ModerationQueue> {
    const queueItem = await this.queueRepo.findOne({ 
      where: { id: queueItemId } 
    });

    if (!queueItem) {
      throw new NotFoundException('Queue item not found');
    }

    queueItem.assignedModeratorId = moderatorId;
    queueItem.assignedAt = new Date();
    queueItem.status = ModerationStatus.IN_REVIEW;

    return await this.queueRepo.save(queueItem);
  }

  /**
   * Auto-assign moderator based on workload
   */
  async autoAssignModerator(
    queueItemId: string,
    availableModeratorIds: string[]
  ): Promise<ModerationQueue> {
    // Get workload for each moderator
    const workloads = await Promise.all(
      availableModeratorIds.map(async (id) => ({
        moderatorId: id,
        count: await this.queueRepo.count({
          where: {
            assignedModeratorId: id,
            status: ModerationStatus.IN_REVIEW,
          },
        }),
      }))
    );

    // Find moderator with least workload
    const leastBusy = workloads.reduce((prev, curr) => 
      curr.count < prev.count ? curr : prev
    );

    return await this.assignModerator(queueItemId, leastBusy.moderatorId);
  }

  /**
   * Take moderation action
   */
  async takeModerationAction(
    queueItemId: string,
    moderatorId: string,
    dto: ModerationActionDto
  ): Promise<ModerationDecision> {
    const queueItem = await this.queueRepo.findOne({ 
      where: { id: queueItemId } 
    });

    if (!queueItem) {
      throw new NotFoundException('Queue item not found');
    }

    const startTime = queueItem.assignedAt || queueItem.createdAt;
    const processingTime = Math.floor(
      (new Date().getTime() - new Date(startTime).getTime()) / 1000
    );

    // Create decision record
    const decision = this.decisionRepo.create({
      queueItemId,
      moderatorId,
      action: dto.action,
      reason: dto.reason,
      internalNotes: dto.internalNotes,
      actionMetadata: dto.actionMetadata,
      isEscalated: dto.action === ModerationAction.ESCALATE,
      escalatedToModeratorId: dto.escalateToModeratorId,
      processingTimeSeconds: processingTime,
    });

    await this.decisionRepo.save(decision);

    // Update queue item status
    queueItem.status = this.mapActionToStatus(dto.action);
    queueItem.reviewedAt = new Date();
    
    if (dto.action !== ModerationAction.ESCALATE) {
      queueItem.resolvedAt = new Date();
    }

    if (dto.action === ModerationAction.ESCALATE && dto.escalateToModeratorId) {
      queueItem.assignedModeratorId = dto.escalateToModeratorId;
      queueItem.assignedAt = new Date();
    }

    await this.queueRepo.save(queueItem);

    // Update metrics
    await this.updateModeratorMetrics(moderatorId, dto.action, processingTime);

    this.logger.log(
      `Moderator ${moderatorId} took action ${dto.action} on ${queueItemId}`
    );

    return decision;
  }

  /**
   * Batch moderation actions
   */
  async batchModerationAction(
    moderatorId: string,
    dto: BatchModerationDto
  ): Promise<{ processed: number; failed: number }> {
    let processed = 0;
    let failed = 0;

    for (const queueItemId of dto.queueItemIds) {
      try {
        await this.takeModerationAction(queueItemId, moderatorId, {
          action: dto.action,
          reason: dto.reason,
          actionMetadata: dto.templateId ? { templateId: dto.templateId } : undefined,
        });
        processed++;
      } catch (error) {
        this.logger.error(`Failed to process ${queueItemId}: ${error.message}`);
        failed++;
      }
    }

    return { processed, failed };
  }

  /**
   * Create appeal
   */
  async createAppeal(dto: CreateAppealDto): Promise<ModerationAppeal> {
    const queueItem = await this.queueRepo.findOne({ 
      where: { id: dto.queueItemId } 
    });

    if (!queueItem) {
      throw new NotFoundException('Queue item not found');
    }

    // Check if already appealed
    const existingAppeal = await this.appealRepo.findOne({
      where: {
        queueItemId: dto.queueItemId,
        status: AppealStatus.PENDING,
      },
    });

    if (existingAppeal) {
      throw new Error('Appeal already exists for this item');
    }

    const appeal = this.appealRepo.create({
      queueItemId: dto.queueItemId,
      appealerId: queueItem.reportedUserId,
      appealReason: dto.appealReason,
      evidence: dto.evidence,
      status: AppealStatus.PENDING,
    });

    await this.appealRepo.save(appeal);

    // Update queue item status
    queueItem.status = ModerationStatus.APPEALED;
    await this.queueRepo.save(queueItem);

    return appeal;
  }

  /**
   * Process appeal
   */
  async processAppeal(
    appealId: string,
    moderatorId: string,
    approved: boolean,
    reviewNotes: string
  ): Promise<ModerationAppeal> {
    const appeal = await this.appealRepo.findOne({
      where: { id: appealId },
      relations: ['queueItem'],
    });

    if (!appeal) {
      throw new NotFoundException('Appeal not found');
    }

    appeal.status = approved ? AppealStatus.APPROVED : AppealStatus.REJECTED;
    appeal.reviewedByModeratorId = moderatorId;
    appeal.reviewNotes = reviewNotes;
    appeal.reviewedAt = new Date();

    await this.appealRepo.save(appeal);

    // If appeal approved, revert the moderation action
    if (approved) {
      appeal.queueItem.status = ModerationStatus.APPROVED;
      await this.queueRepo.save(appeal.queueItem);
    }

    return appeal;
  }

  /**
   * Get moderator performance metrics
   */
  async getModeratorPerformance(
    moderatorId: string,
    startDate?: Date,
    endDate?: Date
  ): Promise<ModeratorPerformanceDto> {
    const queryBuilder = this.metricsRepo.createQueryBuilder('metrics');
    
    queryBuilder.where('metrics.moderatorId = :moderatorId', { moderatorId });

    if (startDate) {
      queryBuilder.andWhere('metrics.date >= :startDate', { startDate });
    }
    if (endDate) {
      queryBuilder.andWhere('metrics.date <= :endDate', { endDate });
    }

    const metrics = await queryBuilder.getMany();

    if (metrics.length === 0) {
      return {
        moderatorId,
        totalReviewed: 0,
        actionBreakdown: { approved: 0, removed: 0, warned: 0, escalated: 0 },
        averageProcessingTime: 0,
        accuracyRate: 0,
        appealsReceived: 0,
        appealsOverturned: 0,
        appealOverturnRate: 0,
      };
    }

    const totals = metrics.reduce(
      (acc, m) => ({
        totalReviewed: acc.totalReviewed + m.totalReviewed,
        approved: acc.approved + m.approved,
        removed: acc.removed + m.removed,
        warned: acc.warned + m.warned,
        escalated: acc.escalated + m.escalated,
        avgProcessingTime: acc.avgProcessingTime + m.averageProcessingTimeSeconds,
        accuracyRate: acc.accuracyRate + m.accuracyRate,
        appealsReceived: acc.appealsReceived + m.appealsReceived,
        appealsOverturned: acc.appealsOverturned + m.appealsOverturned,
      }),
      {
        totalReviewed: 0,
        approved: 0,
        removed: 0,
        warned: 0,
        escalated: 0,
        avgProcessingTime: 0,
        accuracyRate: 0,
        appealsReceived: 0,
        appealsOverturned: 0,
      }
    );

    return {
      moderatorId,
      totalReviewed: totals.totalReviewed,
      actionBreakdown: {
        approved: totals.approved,
        removed: totals.removed,
        warned: totals.warned,
        escalated: totals.escalated,
      },
      averageProcessingTime: Math.round(totals.avgProcessingTime / metrics.length),
      accuracyRate: totals.accuracyRate / metrics.length,
      appealsReceived: totals.appealsReceived,
      appealsOverturned: totals.appealsOverturned,
      appealOverturnRate: totals.appealsReceived > 0 
        ? totals.appealsOverturned / totals.appealsReceived 
        : 0,
    };
  }

  /**
   * Helper: Determine priority based on reason
   */
  private determinePriority(reason: ReportReason): PriorityLevel {
    const priorityMap = {
      [ReportReason.ILLEGAL_CONTENT]: PriorityLevel.CRITICAL,
      [ReportReason.SELF_HARM]: PriorityLevel.CRITICAL,
      [ReportReason.VIOLENCE]: PriorityLevel.HIGH,
      [ReportReason.HATE_SPEECH]: PriorityLevel.HIGH,
      [ReportReason.HARASSMENT]: PriorityLevel.HIGH,
      [ReportReason.NSFW]: PriorityLevel.MEDIUM,
      [ReportReason.SPAM]: PriorityLevel.LOW,
      [ReportReason.MISINFORMATION]: PriorityLevel.MEDIUM,
      [ReportReason.COPYRIGHT]: PriorityLevel.MEDIUM,
      [ReportReason.IMPERSONATION]: PriorityLevel.MEDIUM,
      [ReportReason.OTHER]: PriorityLevel.LOW,
    };

    return priorityMap[reason] || PriorityLevel.MEDIUM;
  }

  /**
   * Helper: Map action to status
   */
  private mapActionToStatus(action: ModerationAction): ModerationStatus {
    const statusMap = {
      [ModerationAction.APPROVE]: ModerationStatus.APPROVED,
      [ModerationAction.REMOVE]: ModerationStatus.REMOVED,
      [ModerationAction.WARN]: ModerationStatus.WARNED,
      [ModerationAction.BAN_USER]: ModerationStatus.REMOVED,
      [ModerationAction.ESCALATE]: ModerationStatus.ESCALATED,
      [ModerationAction.REQUEST_INFO]: ModerationStatus.IN_REVIEW,
    };

    return statusMap[action] || ModerationStatus.IN_REVIEW;
  }

  /**
   * Helper: Update moderator metrics
   */
  private async updateModeratorMetrics(
    moderatorId: string,
    action: ModerationAction,
    processingTime: number
  ): Promise<void> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let metrics = await this.metricsRepo.findOne({
      where: { moderatorId, date: today },
    });

    if (!metrics) {
      metrics = this.metricsRepo.create({
        moderatorId,
        date: today,
      });
    }

    metrics.totalReviewed += 1;

    // Update action counts
    if (action === ModerationAction.APPROVE) metrics.approved += 1;
    if (action === ModerationAction.REMOVE) metrics.removed += 1;
    if (action === ModerationAction.WARN) metrics.warned += 1;
    if (action === ModerationAction.ESCALATE) metrics.escalated += 1;

    // Update average processing time
    const totalTime = metrics.averageProcessingTimeSeconds * (metrics.totalReviewed - 1);
    metrics.averageProcessingTimeSeconds = Math.round(
      (totalTime + processingTime) / metrics.totalReviewed
    );

    await this.metricsRepo.save(metrics);
  }

  /**
   * Helper: Map to DTO
   */
  private mapToDto(item: ModerationQueue): ModerationQueueItemDto {
    const now = new Date();
    const createdAt = new Date(item.createdAt);
    const timeInQueue = Math.floor((now.getTime() - createdAt.getTime()) / 1000);

    return {
      id: item.id,
      contentType: item.contentType,
      contentId: item.contentId,
      reportedUserId: item.reportedUserId,
      reporterId: item.reporterId,
      reason: item.reason,
      description: item.description,
      status: item.status,
      priority: item.priority,
      assignedModeratorId: item.assignedModeratorId,
      contentSnapshot: item.contentSnapshot,
      isAutoFlagged: item.isAutoFlagged,
      reportCount: item.reportCount,
      createdAt: item.createdAt,
      assignedAt: item.assignedAt,
      timeInQueue,
    };
  }
}

// ============================================================================
// TEMPLATE SERVICE
// ============================================================================

@Injectable()
export class ModerationTemplateService {
  constructor(
    @InjectRepository(ModerationTemplate)
    private templateRepo: Repository<ModerationTemplate>,
  ) {}

  async getTemplates(action?: ModerationAction): Promise<ModerationTemplate[]> {
    const where: any = { isActive: true };
    if (action) {
      where.action = action;
    }

    return await this.templateRepo.find({ where });
  }

  async createTemplate(data: Partial<ModerationTemplate>): Promise<ModerationTemplate> {
    const template = this.templateRepo.create(data);
    return await this.templateRepo.save(template);
  }
}

// ============================================================================
// ANALYTICS SERVICE
// ============================================================================

import { Cron, CronExpression } from '@nestjs/schedule';

@Injectable()
export class ModerationAnalyticsService {
  private readonly logger = new Logger(ModerationAnalyticsService.name);

  constructor(
    @InjectRepository(ModerationQueue)
    private queueRepo: Repository<ModerationQueue>,
    @InjectRepository(ModerationAnalytics)
    private analyticsRepo: Repository<ModerationAnalytics>,
  ) {}

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async captureAnalytics(): Promise<void> {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    yesterday.setHours(0, 0, 0, 0);

    const endOfYesterday = new Date(yesterday);
    endOfYesterday.setHours(23, 59, 59, 999);

    const reports = await this.queueRepo.find({
      where: {
        createdAt: Between(yesterday, endOfYesterday) as any,
      },
    });

    const reportsByReason = {} as Record<ReportReason, number>;
    const reportsByContentType = {} as Record<ContentType, number>;
    let autoFlagged = 0;

    for (const report of reports) {
      reportsByReason[report.reason] = (reportsByReason[report.reason] || 0) + 1;
      reportsByContentType[report.contentType] = 
        (reportsByContentType[report.contentType] || 0) + 1;
      
      if (report.isAutoFlagged) autoFlagged++;
    }

    const resolved = reports.filter(r => r.resolvedAt).length;
    const pending = reports.filter(r => r.status === ModerationStatus.PENDING).length;

    const queueTimes = reports
      .filter(r => r.resolvedAt)
      .map(r => {
        const start = new Date(r.createdAt).getTime();
        const end = new Date(r.resolvedAt!).getTime();
        return (end - start) / 1000;
      });

    const averageQueueTime = queueTimes.length > 0
      ? Math.round(queueTimes.reduce((a, b) => a + b, 0) / queueTimes.length)
      : 0;

    const analytics = this.analyticsRepo.create({
      date: yesterday,
      totalReports: reports.length,
      autoFlagged,
      userReported: reports.length - autoFlagged,
      reportsByReason,
      reportsByContentType,
      averageQueueTime,
      pendingCount: pending,
      resolvedCount: resolved,
    });

    await this.analyticsRepo.save(analytics);

    this.logger.log(`Analytics captured for ${yesterday.toDateString()}`);
  }

  async getAnalytics(startDate: Date, endDate: Date): Promise<ModerationAnalytics[]> {
    return await this.analyticsRepo.find({
      where: {
        date: Between(startDate, endDate) as any,
      },
      order: { date: 'ASC' },
    });
  }
}

// ============================================================================
// CONTROLLER
// ============================================================================

import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';

@ApiTags('Admin - Moderation')
@Controller('admin/moderation')
@ApiBearerAuth()
// @UseGuards(AdminGuard) // Add your admin guard here
export class ModerationController {
  constructor(
    private readonly queueService: ModerationQueueService,
    private readonly templateService: ModerationTemplateService,
    private readonly analyticsService: ModerationAnalyticsService,
  ) {}

  @Get('queue')
  @ApiOperation({ summary: 'Get moderation queue' })
  async getQueue(@Query() filters: ModerationQueueFilterDto) {
    return await this.queueService.getQueue(filters);
  }

  @Post('queue/:id/assign')
  @ApiOperation({ summary: 'Assign moderator to queue item' })
  async assignModerator(
    @Param('id') id: string,
    @Body('moderatorId') moderatorId: string
  ) {
    return await this.queueService.assignModerator(id, moderatorId);
  }

  @Post('queue/:id/action')
  @ApiOperation({ summary: 'Take moderation action' })
  async takeModerationAction(
    @Param('id') id: string,
    @Body() dto: ModerationActionDto,
    @Request() req: any
  ) {
    const moderatorId = req.user.id;
    return await this.queueService.takeModerationAction(id, moderatorId, dto);
  }

  @Post('queue/batch')
  @ApiOperation({ summary: 'Batch moderation actions' })
  async batchModerationAction(
    @Body() dto: BatchModerationDto,
    @Request() req: any
  ) {
    const moderatorId = req.user.id;
    return await this.queueService.batchModerationAction(moderatorId, dto);
  }

  @Post('appeals')
  @ApiOperation({ summary: 'Create an appeal' })
  async createAppeal(@Body() dto: CreateAppealDto) {
    return await this.queueService.createAppeal(dto);
  }

  @Put('appeals/:id')
  @ApiOperation({ summary: 'Process appeal' })
  async processAppeal(
    @Param('id') id: string,
    @Body('approved') approved: boolean,
    @Body('reviewNotes') reviewNotes: string,
    @Request() req: any
  ) {
    const moderatorId = req.user.id;
    return await this.queueService.processAppeal(id, moderatorId, approved, reviewNotes);
  }

  @Get('metrics/:moderatorId')
  @ApiOperation({ summary: 'Get moderator performance metrics' })
  async getModeratorPerformance(
    @Param('moderatorId') moderatorId: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string
  ) {
    return await this.queueService.getModeratorPerformance(
      moderatorId,
      startDate ? new Date(startDate) : undefined,
      endDate ? new Date(endDate) : undefined
    );
  }

  @Get('templates')
  @ApiOperation({ summary: 'Get moderation templates' })
  async getTemplates(@Query('action') action?: ModerationAction) {
    return await this.templateService.getTemplates(action);
  }

  @Get('analytics')
  @ApiOperation({ summary: 'Get moderation analytics' })
  async getAnalytics(
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string
  ) {
    return await this.analyticsService.getAnalytics(
      new Date(startDate),
      new Date(endDate)
    );
  }
}

// ============================================================================
// MODULE
// ============================================================================

import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ModerationQueue,
      ModerationDecision,
      ModerationAppeal,
      ModerationTemplate,
      ModeratorMetrics,
      ModerationAnalytics,
    ]),
    ScheduleModule.forRoot(),
  ],
  controllers: [ModerationController],
  providers: [
    ModerationQueueService,
    AutoFlaggingService,
    ModerationTemplateService,
    ModerationAnalyticsService,
  ],
  exports: [ModerationQueueService, AutoFlaggingService],
})
export class ModerationModule {}

// ============================================================================
// USAGE EXAMPLES
// ============================================================================

/**
 * EXAMPLE 1: Auto-flag content when user posts
 * 
 * @Injectable()
 * export class MessageService {
 *   constructor(
 *     private autoFlaggingService: AutoFlaggingService
 *   ) {}
 * 
 *   async createMessage(userId: string, content: string) {
 *     const message = await this.messageRepo.save({ userId, content });
 *     
 *     // Auto-flag if needed
 *     await this.autoFlaggingService.analyzeContent(
 *       ContentType.MESSAGE,
 *       message.id,
 *       content,
 *       userId,
 *       { roomId: message.roomId }
 *     );
 *     
 *     return message;
 *   }
 * }
 */

/**
 * EXAMPLE 2: User reports content
 * 
 * @Post('report')
 * async reportContent(
 *   @Body() dto: CreateReportDto,
 *   @Request() req: any
 * ) {
 *   const reporterId = req.user.id;
 *   
 *   return await this.queueService.createReport(
 *     dto,
 *     reporterId,
 *     { text: "Content snapshot here..." }
 *   );
 * }
 */

/**
 * EXAMPLE 3: Moderator reviews content
 * 
 * // Get queue
 * GET /admin/moderation/queue?status=pending&priority=high&page=1&limit=50
 * 
 * // Assign to self
 * POST /admin/moderation/queue/{id}/assign
 * { "moderatorId": "mod-123" }
 * 
 * // Take action
 * POST /admin/moderation/queue/{id}/action
 * {
 *   "action": "remove",
 *   "reason": "Violates community guidelines",
 *   "internalNotes": "Clear spam content",
 *   "actionMetadata": {
 *     "templateId": "spam-template-1"
 *   }
 * }
 */

/**
 * EXAMPLE 4: Batch moderation
 * 
 * POST /admin/moderation/queue/batch
 * {
 *   "queueItemIds": ["id1", "id2", "id3"],
 *   "action": "approve",
 *   "reason": "All verified as legitimate content",
 *   "templateId": "bulk-approve-template"
 * }
 */

/**
 * EXAMPLE 5: User appeals decision
 * 
 * POST /admin/moderation/appeals
 * {
 *   "queueItemId": "queue-123",
 *   "appealReason": "This was a misunderstanding. The content was satire.",
 *   "evidence": {
 *     "text": "Additional context...",
 *     "urls": ["https://example.com/context"]
 *   }
 * }
 * 
 * // Senior mod reviews appeal
 * PUT /admin/moderation/appeals/{id}
 * {
 *   "approved": true,
 *   "reviewNotes": "After review, the content is acceptable."
 * }
 */

/**
 * EXAMPLE 6: Escalate to senior moderator
 * 
 * POST /admin/moderation/queue/{id}/action
 * {
 *   "action": "escalate",
 *   "reason": "Requires senior review - unclear if violates policy",
 *   "internalNotes": "Borderline case, need second opinion",
 *   "escalateToModeratorId": "senior-mod-456"
 * }
 */

/**
 * DATABASE SETUP:
 * 
 * Run migrations:
 * npm run migration:generate -- -n CreateModerationTables
 * npm run migration:run
 * 
 * Seed templates:
 * npm run seed:moderation-templates
 */
/**
 * ============================================================================
 * COMPREHENSIVE NESTJS MODERATION QUEUE SYSTEM IMPLEMENTATION
 * ============================================================================
 * 
 * This file contains a complete implementation of a content moderation system
 * with queue management, auto-flagging, appeals, and performance tracking.
 * 
 * Features:
 * - Auto-flagging for reported content
 * - Moderation queue with priority levels
 * - Multiple action types (approve, remove, warn, ban)
 * - Moderator assignment and workload balancing
 * - Batch moderation actions
 * - Appeal system with workflow
 * - Moderator performance metrics
 * - Escalation to senior moderators
 * - Moderation templates
 * - Comprehensive analytics
 */

// ============================================================================
// ENTITIES
// ============================================================================

import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  ManyToOne,
  JoinColumn,
  OneToMany,
} from 'typeorm';

export enum ContentType {
  MESSAGE = 'message',
  POST = 'post',
  COMMENT = 'comment',
  PROFILE = 'profile',
  ROOM = 'room',
  IMAGE = 'image',
  VIDEO = 'video',
}

export enum ReportReason {
  SPAM = 'spam',
  HARASSMENT = 'harassment',
  HATE_SPEECH = 'hate_speech',
  VIOLENCE = 'violence',
  NSFW = 'nsfw',
  MISINFORMATION = 'misinformation',
  COPYRIGHT = 'copyright',
  IMPERSONATION = 'impersonation',
  SELF_HARM = 'self_harm',
  ILLEGAL_CONTENT = 'illegal_content',
  OTHER = 'other',
}

export enum ModerationStatus {
  PENDING = 'pending',
  IN_REVIEW = 'in_review',
  APPROVED = 'approved',
  REMOVED = 'removed',
  WARNED = 'warned',
  ESCALATED = 'escalated',
  APPEALED = 'appealed',
}

export enum ModerationAction {
  APPROVE = 'approve',
  REMOVE = 'remove',
  WARN = 'warn',
  BAN_USER = 'ban_user',
  ESCALATE = 'escalate',
  REQUEST_INFO = 'request_info',
}

export enum PriorityLevel {
  CRITICAL = 'critical', // 1-2 hours
  HIGH = 'high',         // 4-8 hours
  MEDIUM = 'medium',     // 24 hours
  LOW = 'low',           // 48+ hours
}

export enum AppealStatus {
  PENDING = 'pending',
  UNDER_REVIEW = 'under_review',
  APPROVED = 'approved',
  REJECTED = 'rejected',
}

@Entity('moderation_queue')
@Index(['status', 'priority'])
@Index(['assignedModeratorId', 'status'])
@Index(['contentType', 'contentId'])
@Index(['createdAt'])
export class ModerationQueue {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'enum', enum: ContentType })
  contentType: ContentType;

  @Column({ type: 'uuid' })
  contentId: string;

  @Column({ type: 'uuid' })
  reportedUserId: string;

  @Column({ type: 'uuid' })
  reporterId: string;

  @Column({ type: 'enum', enum: ReportReason })
  reason: ReportReason;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ type: 'enum', enum: ModerationStatus, default: ModerationStatus.PENDING })
  status: ModerationStatus;

  @Column({ type: 'enum', enum: PriorityLevel, default: PriorityLevel.MEDIUM })
  priority: PriorityLevel;

  @Column({ type: 'uuid', nullable: true })
  assignedModeratorId: string;

  @Column({ type: 'timestamp', nullable: true })
  assignedAt: Date;

  @Column({ type: 'jsonb', nullable: true })
  contentSnapshot: {
    text?: string;
    imageUrl?: string;
    metadata?: any;
  };

  @Column({ type: 'jsonb', nullable: true })
  autoFlagMetadata: {
    confidence?: number;
    flaggedKeywords?: string[];
    aiScore?: number;
    riskFactors?: string[];
  };

  @Column({ type: 'boolean', default: false })
  isAutoFlagged: boolean;

  @Column({ type: 'integer', default: 1 })
  reportCount: number;

  @Column({ type: 'timestamp', nullable: true })
  reviewedAt: Date;

  @Column({ type: 'timestamp', nullable: true })
  resolvedAt: Date;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @OneToMany(() => ModerationDecision, decision => decision.queueItem)
  decisions: ModerationDecision[];

  @OneToMany(() => ModerationAppeal, appeal => appeal.queueItem)
  appeals: ModerationAppeal[];
}

@Entity('moderation_decisions')
@Index(['queueItemId'])
@Index(['moderatorId'])
export class ModerationDecision {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  queueItemId: string;

  @ManyToOne(() => ModerationQueue, queue => queue.decisions)
  @JoinColumn({ name: 'queueItemId' })
  queueItem: ModerationQueue;

  @Column({ type: 'uuid' })
  moderatorId: string;

  @Column({ type: 'enum', enum: ModerationAction })
  action: ModerationAction;

  @Column({ type: 'text', nullable: true })
  reason: string;

  @Column({ type: 'text', nullable: true })
  internalNotes: string;

  @Column({ type: 'jsonb', nullable: true })
  actionMetadata: {
    banDuration?: number;
    warningLevel?: number;
    templateId?: string;
    customMessage?: string;
  };

  @Column({ type: 'boolean', default: false })
  isEscalated: boolean;

  @Column({ type: 'uuid', nullable: true })
  escalatedToModeratorId: string;

  @Column({ type: 'integer', nullable: true })
  processingTimeSeconds: number;

  @CreateDateColumn()
  createdAt: Date;
}

@Entity('moderation_appeals')
@Index(['queueItemId'])
@Index(['status'])
export class ModerationAppeal {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  queueItemId: string;

  @ManyToOne(() => ModerationQueue, queue => queue.appeals)
  @JoinColumn({ name: 'queueItemId' })
  queueItem: ModerationQueue;

  @Column({ type: 'uuid' })
  appealerId: string;

  @Column({ type: 'text' })
  appealReason: string;

  @Column({ type: 'jsonb', nullable: true })
  evidence: {
    text?: string;
    urls?: string[];
    attachments?: string[];
  };

  @Column({ type: 'enum', enum: AppealStatus, default: AppealStatus.PENDING })
  status: AppealStatus;

  @Column({ type: 'uuid', nullable: true })
  reviewedByModeratorId: string;

  @Column({ type: 'text', nullable: true })
  reviewNotes: string;

  @Column({ type: 'timestamp', nullable: true })
  reviewedAt: Date;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

@Entity('moderation_templates')
export class ModerationTemplate {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 200 })
  name: string;

  @Column({ type: 'enum', enum: ModerationAction })
  action: ModerationAction;

  @Column({ type: 'text' })
  messageTemplate: string;

  @Column({ type: 'text', nullable: true })
  internalNotesTemplate: string;

  @Column({ type: 'jsonb', nullable: true })
  defaultSettings: {
    banDuration?: number;
    warningLevel?: number;
  };

  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

@Entity('moderator_metrics')
@Index(['moderatorId', 'date'])
export class ModeratorMetrics {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  moderatorId: string;

  @Column({ type: 'date' })
  date: Date;

  @Column({ type: 'integer', default: 0 })
  totalReviewed: number;

  @Column({ type: 'integer', default: 0 })
  approved: number;

  @Column({ type: 'integer', default: 0 })
  removed: number;

  @Column({ type: 'integer', default: 0 })
  warned: number;

  @Column({ type: 'integer', default: 0 })
  escalated: number;

  @Column({ type: 'integer', default: 0 })
  averageProcessingTimeSeconds: number;

  @Column({ type: 'decimal', precision: 5, scale: 2, default: 0 })
  accuracyRate: number;

  @Column({ type: 'integer', default: 0 })
  appealsReceived: number;

  @Column({ type: 'integer', default: 0 })
  appealsOverturned: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

@Entity('moderation_analytics')
export class ModerationAnalytics {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'date' })
  date: Date;

  @Column({ type: 'integer', default: 0 })
  totalReports: number;

  @Column({ type: 'integer', default: 0 })
  autoFlagged: number;

  @Column({ type: 'integer', default: 0 })
  userReported: number;

  @Column({ type: 'jsonb' })
  reportsByReason: Record<ReportReason, number>;

  @Column({ type: 'jsonb' })
  reportsByContentType: Record<ContentType, number>;

  @Column({ type: 'integer', default: 0 })
  averageQueueTime: number;

  @Column({ type: 'integer', default: 0 })
  pendingCount: number;

  @Column({ type: 'integer', default: 0 })
  resolvedCount: number;

  @CreateDateColumn()
  createdAt: Date;
}

// ============================================================================
// DTOs
// ============================================================================

export class CreateReportDto {
  contentType: ContentType;
  contentId: string;
  reportedUserId: string;
  reason: ReportReason;
  description?: string;
}

export class ModerationQueueFilterDto {
  status?: ModerationStatus;
  priority?: PriorityLevel;
  contentType?: ContentType;
  assignedModeratorId?: string;
  isAutoFlagged?: boolean;
  page?: number = 1;
  limit?: number = 50;
  sortBy?: 'createdAt' | 'priority' | 'reportCount' = 'createdAt';
  sortOrder?: 'ASC' | 'DESC' = 'DESC';
}

export class ModerationActionDto {
  action: ModerationAction;
  reason?: string;
  internalNotes?: string;
  actionMetadata?: {
    banDuration?: number;
    warningLevel?: number;
    templateId?: string;
    customMessage?: string;
  };
  escalateToModeratorId?: string;
}

export class BatchModerationDto {
  queueItemIds: string[];
  action: ModerationAction;
  reason?: string;
  templateId?: string;
}

export class CreateAppealDto {
  queueItemId: string;
  appealReason: string;
  evidence?: {
    text?: string;
    urls?: string[];
    attachments?: string[];
  };
}

export class ModerationQueueItemDto {
  id: string;
  contentType: ContentType;
  contentId: string;
  reportedUserId: string;
  reporterId: string;
  reason: ReportReason;
  description: string;
  status: ModerationStatus;
  priority: PriorityLevel;
  assignedModeratorId?: string;
  contentSnapshot: any;
  isAutoFlagged: boolean;
  reportCount: number;
  createdAt: Date;
  assignedAt?: Date;
  timeInQueue?: number;
}

export class ModeratorPerformanceDto {
  moderatorId: string;
  totalReviewed: number;
  actionBreakdown: {
    approved: number;
    removed: number;
    warned: number;
    escalated: number;
  };
  averageProcessingTime: number;
  accuracyRate: number;
  appealsReceived: number;
  appealsOverturned: number;
  appealOverturnRate: number;
}

// ============================================================================
// AUTO-FLAGGING SERVICE
// ============================================================================

import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between } from 'typeorm';

@Injectable()
export class AutoFlaggingService {
  private readonly logger = new Logger(AutoFlaggingService.name);

  // Keyword lists for auto-flagging
  private readonly SPAM_KEYWORDS = [
    'buy now', 'click here', 'limited time', 'act now', 'free money',
    'make money fast', 'work from home', 'casino', 'viagra'
  ];

  private readonly HARASSMENT_KEYWORDS = [
    'kill yourself', 'kys', 'die', 'worthless', 'pathetic'
  ];

  private readonly HATE_SPEECH_KEYWORDS = [
    // Add appropriate keywords based on your content policy
  ];

  constructor(
    @InjectRepository(ModerationQueue)
    private queueRepo: Repository<ModerationQueue>,
  ) {}

  /**
   * Analyze content and auto-flag if necessary
   */
  async analyzeContent(
    contentType: ContentType,
    contentId: string,
    content: string,
    userId: string,
    metadata?: any
  ): Promise<void> {
    const analysis = await this.runContentAnalysis(content, metadata);

    if (analysis.shouldFlag) {
      await this.createAutoFlag(
        contentType,
        contentId,
        userId,
        analysis
      );
    }
  }

  /**
   * Run content analysis
   */
  private async runContentAnalysis(
    content: string,
    metadata?: any
  ): Promise<{
    shouldFlag: boolean;
    reason: ReportReason;
    priority: PriorityLevel;
    confidence: number;
    flaggedKeywords: string[];
    riskFactors: string[];
  }> {
    const contentLower = content.toLowerCase();
    const flaggedKeywords: string[] = [];
    const riskFactors: string[] = [];
    let reason = ReportReason.OTHER;
    let priority = PriorityLevel.LOW;
    let confidence = 0;

    // Check for spam
    const spamMatches = this.SPAM_KEYWORDS.filter(keyword => 
      contentLower.includes(keyword.toLowerCase())
    );
    if (spamMatches.length > 0) {
      flaggedKeywords.push(...spamMatches);
      reason = ReportReason.SPAM;
      confidence += spamMatches.length * 0.2;
      riskFactors.push('spam_keywords_detected');
    }

    // Check for harassment
    const harassmentMatches = this.HARASSMENT_KEYWORDS.filter(keyword => 
      contentLower.includes(keyword.toLowerCase())
    );
    if (harassmentMatches.length > 0) {
      flaggedKeywords.push(...harassmentMatches);
      reason = ReportReason.HARASSMENT;
      confidence += harassmentMatches.length * 0.3;
      priority = PriorityLevel.HIGH;
      riskFactors.push('harassment_language_detected');
    }

    // Check content length and repetition
    if (content.length > 500 && this.hasExcessiveRepetition(content)) {
      confidence += 0.2;
      riskFactors.push('excessive_repetition');
    }

    // Check for excessive caps
    const capsRatio = this.calculateCapsRatio(content);
    if (capsRatio > 0.7 && content.length > 20) {
      confidence += 0.15;
      riskFactors.push('excessive_caps');
    }

    // Check for URL spam
    const urlCount = (content.match(/https?:\/\//g) || []).length;
    if (urlCount > 3) {
      confidence += 0.2;
      riskFactors.push('excessive_urls');
    }

    // Determine if should flag (confidence threshold)
    const shouldFlag = confidence >= 0.5;

    // Adjust priority based on confidence
    if (confidence >= 0.9) {
      priority = PriorityLevel.CRITICAL;
    } else if (confidence >= 0.7) {
      priority = PriorityLevel.HIGH;
    } else if (confidence >= 0.5) {
      priority = PriorityLevel.MEDIUM;
    }

    return {
      shouldFlag,
      reason,
      priority,
      confidence: Math.min(confidence, 1),
      flaggedKeywords,
      riskFactors,
    };
  }

  /**
   * Create auto-flagged item in moderation queue
   */
  private async createAutoFlag(
    contentType: ContentType,
    contentId: string,
    userId: string,
    analysis: any
  ): Promise<void> {
    const queueItem = this.queueRepo.create({
      contentType,
      contentId,
      reportedUserId: userId,
      reporterId: 'system',
      reason: analysis.reason,
      description: 'Auto-flagged by content analysis system',
      status: ModerationStatus.PENDING,
      priority: analysis.priority,
      isAutoFlagged: true,
      autoFlagMetadata: {
        confidence: analysis.confidence,
        flaggedKeywords: analysis.flaggedKeywords,
        riskFactors: analysis.riskFactors,
      },
    });

    await this.queueRepo.save(queueItem);

    this.logger.warn(
      `Auto-flagged content: ${contentType}:${contentId} - ${analysis.reason} (confidence: ${analysis.confidence})`
    );
  }

  /**
   * Check for excessive repetition
   */
  private hasExcessiveRepetition(content: string): boolean {
    const words = content.split(/\s+/);
    const wordCount = new Map<string, number>();

    for (const word of words) {
      const normalized = word.toLowerCase();
      wordCount.set(normalized, (wordCount.get(normalized) || 0) + 1);
    }

    // Check if any word appears more than 30% of total words
    const maxCount = Math.max(...wordCount.values());
    return maxCount / words.length > 0.3;
  }

  /**
   * Calculate caps ratio
   */
  private calculateCapsRatio(content: string): number {
    const letters = content.replace(/[^a-zA-Z]/g, '');
    if (letters.length === 0) return 0;

    const caps = content.replace(/[^A-Z]/g, '');
    return caps.length / letters.length;
  }
}

// ============================================================================
// MODERATION QUEUE SERVICE
// ============================================================================

@Injectable()
export class ModerationQueueService {
  private readonly logger = new Logger(ModerationQueueService.name);

  constructor(
    @InjectRepository(ModerationQueue)
    private queueRepo: Repository<ModerationQueue>,
    @InjectRepository(ModerationDecision)
    private decisionRepo: Repository<ModerationDecision>,
    @InjectRepository(ModerationAppeal)
    private appealRepo: Repository<ModerationAppeal>,
    @InjectRepository(ModeratorMetrics)
    private metricsRepo: Repository<ModeratorMetrics>,
    private autoFlaggingService: AutoFlaggingService,
  ) {}

  /**
   * Create a new report
   */
  async createReport(
    dto: CreateReportDto,
    reporterId: string,
    contentSnapshot?: any
  ): Promise<ModerationQueue> {
    // Check if already reported
    let existing = await this.queueRepo.findOne({
      where: {
        contentType: dto.contentType,
        contentId: dto.contentId,
        status: ModerationStatus.PENDING,
      },
    });

    if (existing) {
      // Increment report count
      existing.reportCount += 1;
      
      // Upgrade priority if multiple reports
      if (existing.reportCount >= 5 && existing.priority !== PriorityLevel.CRITICAL) {
        existing.priority = PriorityLevel.HIGH;
      }
      
      return await this.queueRepo.save(existing);
    }

    // Create new queue item
    const queueItem = this.queueRepo.create({
      ...dto,
      reporterId,
      contentSnapshot,
      status: ModerationStatus.PENDING,
      priority: this.determinePriority(dto.reason),
    });

    return await this.queueRepo.save(queueItem);
  }

  /**
   * Get moderation queue with filters
   */
  async getQueue(
    filters: ModerationQueueFilterDto
  ): Promise<{
    items: ModerationQueueItemDto[];
    total: number;
    page: number;
    totalPages: number;
  }> {
    const { page = 1, limit = 50, sortBy = 'createdAt', sortOrder = 'DESC' } = filters;
    const skip = (page - 1) * limit;

    const queryBuilder = this.queueRepo.createQueryBuilder('queue');

    // Apply filters
    if (filters.status) {
      queryBuilder.andWhere('queue.status = :status', { status: filters.status });
    }
    if (filters.priority) {
      queryBuilder.andWhere('queue.priority = :priority', { priority: filters.priority });
    }
    if (filters.contentType) {
      queryBuilder.andWhere('queue.contentType = :contentType', { contentType: filters.contentType });
    }
    if (filters.assignedModeratorId) {
      queryBuilder.andWhere('queue.assignedModeratorId = :moderatorId', { 
        moderatorId: filters.assignedModeratorId 
      });
    }
    if (filters.isAutoFlagged !== undefined) {
      queryBuilder.andWhere('queue.isAutoFlagged = :isAutoFlagged', { 
        isAutoFlagged: filters.isAutoFlagged 
      });
    }

    // Apply sorting
    const orderMap = {
      createdAt: 'queue.createdAt',
      priority: 'queue.priority',
      reportCount: 'queue.reportCount',
    };

    queryBuilder.orderBy(orderMap[sortBy] || 'queue.createdAt', sortOrder);

    // Get total count
    const total = await queryBuilder.getCount();

    // Apply pagination
    queryBuilder.skip(skip).take(limit);

    const items = await queryBuilder.getMany();

    return {
      items: items.map(item => this.mapToDto(item)),
      total,
      page,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Assign moderator to queue item
   */
  async assignModerator(
    queueItemId: string,
    moderatorId: string
  ): Promise<ModerationQueue> {
    const queueItem = await this.queueRepo.findOne({ 
      where: { id: queueItemId } 
    });

    if (!queueItem) {
      throw new NotFoundException('Queue item not found');
    }

    queueItem.assignedModeratorId = moderatorId;
    queueItem.assignedAt = new Date();
    queueItem.status = ModerationStatus.IN_REVIEW;

    return await this.queueRepo.save(queueItem);
  }

  /**
   * Auto-assign moderator based on workload
   */
  async autoAssignModerator(
    queueItemId: string,
    availableModeratorIds: string[]
  ): Promise<ModerationQueue> {
    // Get workload for each moderator
    const workloads = await Promise.all(
      availableModeratorIds.map(async (id) => ({
        moderatorId: id,
        count: await this.queueRepo.count({
          where: {
            assignedModeratorId: id,
            status: ModerationStatus.IN_REVIEW,
          },
        }),
      }))
    );

    // Find moderator with least workload
    const leastBusy = workloads.reduce((prev, curr) => 
      curr.count < prev.count ? curr : prev
    );

    return await this.assignModerator(queueItemId, leastBusy.moderatorId);
  }

  /**
   * Take moderation action
   */
  async takeModerationAction(
    queueItemId: string,
    moderatorId: string,
    dto: ModerationActionDto
  ): Promise<ModerationDecision> {
    const queueItem = await this.queueRepo.findOne({ 
      where: { id: queueItemId } 
    });

    if (!queueItem) {
      throw new NotFoundException('Queue item not found');
    }

    const startTime = queueItem.assignedAt || queueItem.createdAt;
    const processingTime = Math.floor(
      (new Date().getTime() - new Date(startTime).getTime()) / 1000
    );

    // Create decision record
    const decision = this.decisionRepo.create({
      queueItemId,
      moderatorId,
      action: dto.action,
      reason: dto.reason,
      internalNotes: dto.internalNotes,
      actionMetadata: dto.actionMetadata,
      isEscalated: dto.action === ModerationAction.ESCALATE,
      escalatedToModeratorId: dto.escalateToModeratorId,
      processingTimeSeconds: processingTime,
    });

    await this.decisionRepo.save(decision);

    // Update queue item status
    queueItem.status = this.mapActionToStatus(dto.action);
    queueItem.reviewedAt = new Date();
    
    if (dto.action !== ModerationAction.ESCALATE) {
      queueItem.resolvedAt = new Date();
    }

    if (dto.action === ModerationAction.ESCALATE && dto.escalateToModeratorId) {
      queueItem.assignedModeratorId = dto.escalateToModeratorId;
      queueItem.assignedAt = new Date();
    }

    await this.queueRepo.save(queueItem);

    // Update metrics
    await this.updateModeratorMetrics(moderatorId, dto.action, processingTime);

    this.logger.log(
      `Moderator ${moderatorId} took action ${dto.action} on ${queueItemId}`
    );

    return decision;
  }

  /**
   * Batch moderation actions
   */
  async batchModerationAction(
    moderatorId: string,
    dto: BatchModerationDto
  ): Promise<{ processed: number; failed: number }> {
    let processed = 0;
    let failed = 0;

    for (const queueItemId of dto.queueItemIds) {
      try {
        await this.takeModerationAction(queueItemId, moderatorId, {
          action: dto.action,
          reason: dto.reason,
          actionMetadata: dto.templateId ? { templateId: dto.templateId } : undefined,
        });
        processed++;
      } catch (error) {
        this.logger.error(`Failed to process ${queueItemId}: ${error.message}`);
        failed++;
      }
    }

    return { processed, failed };
  }

  /**
   * Create appeal
   */
  async createAppeal(dto: CreateAppealDto): Promise<ModerationAppeal> {
    const queueItem = await this.queueRepo.findOne({ 
      where: { id: dto.queueItemId } 
    });

    if (!queueItem) {
      throw new NotFoundException('Queue item not found');
    }

    // Check if already appealed
    const existingAppeal = await this.appealRepo.findOne({
      where: {
        queueItemId: dto.queueItemId,
        status: AppealStatus.PENDING,
      },
    });

    if (existingAppeal) {
      throw new Error('Appeal already exists for this item');
    }

    const appeal = this.appealRepo.create({
      queueItemId: dto.queueItemId,
      appealerId: queueItem.reportedUserId,
      appealReason: dto.appealReason,
      evidence: dto.evidence,
      status: AppealStatus.PENDING,
    });

    await this.appealRepo.save(appeal);

    // Update queue item status
    queueItem.status = ModerationStatus.APPEALED;
    await this.queueRepo.save(queueItem);

    return appeal;
  }

  /**
   * Process appeal
   */
  async processAppeal(
    appealId: string,
    moderatorId: string,
    approved: boolean,
    reviewNotes: string
  ): Promise<ModerationAppeal> {
    const appeal = await this.appealRepo.findOne({
      where: { id: appealId },
      relations: ['queueItem'],
    });

    if (!appeal) {
      throw new NotFoundException('Appeal not found');
    }

    appeal.status = approved ? AppealStatus.APPROVED : AppealStatus.REJECTED;
    appeal.reviewedByModeratorId = moderatorId;
    appeal.reviewNotes = reviewNotes;
    appeal.reviewedAt = new Date();

    await this.appealRepo.save(appeal);

    // If appeal approved, revert the moderation action
    if (approved) {
      appeal.queueItem.status = ModerationStatus.APPROVED;
      await this.queueRepo.save(appeal.queueItem);
    }

    return appeal;
  }

  /**
   * Get moderator performance metrics
   */
  async getModeratorPerformance(
    moderatorId: string,
    startDate?: Date,
    endDate?: Date
  ): Promise<ModeratorPerformanceDto> {
    const queryBuilder = this.metricsRepo.createQueryBuilder('metrics');
    
    queryBuilder.where('metrics.moderatorId = :moderatorId', { moderatorId });

    if (startDate) {
      queryBuilder.andWhere('metrics.date >= :startDate', { startDate });
    }
    if (endDate) {
      queryBuilder.andWhere('metrics.date <= :endDate', { endDate });
    }

    const metrics = await queryBuilder.getMany();

    if (metrics.length === 0) {
      return {
        moderatorId,
        totalReviewed: 0,
        actionBreakdown: { approved: 0, removed: 0, warned: 0, escalated: 0 },
        averageProcessingTime: 0,
        accuracyRate: 0,
        appealsReceived: 0,
        appealsOverturned: 0,
        appealOverturnRate: 0,
      };
    }

    const totals = metrics.reduce(
      (acc, m) => ({
        totalReviewed: acc.totalReviewed + m.totalReviewed,
        approved: acc.approved + m.approved,
        removed: acc.removed + m.removed,
        warned: acc.warned + m.warned,
        escalated: acc.escalated + m.escalated,
        avgProcessingTime: acc.avgProcessingTime + m.averageProcessingTimeSeconds,
        accuracyRate: acc.accuracyRate + m.accuracyRate,
        appealsReceived: acc.appealsReceived + m.appealsReceived,
        appealsOverturned: acc.appealsOverturned + m.appealsOverturned,
      }),
      {
        totalReviewed: 0,
        approved: 0,
        removed: 0,
        warned: 0,
        escalated: 0,
        avgProcessingTime: 0,
        accuracyRate: 0,
        appealsReceived: 0,
        appealsOverturned: 0,
      }
    );

    return {
      moderatorId,
      totalReviewed: totals.totalReviewed,
      actionBreakdown: {
        approved: totals.approved,
        removed: totals.removed,
        warned: totals.warned,
        escalated: totals.escalated,
      },
      averageProcessingTime: Math.round(totals.avgProcessingTime / metrics.length),
      accuracyRate: totals.accuracyRate / metrics.length,
      appealsReceived: totals.appealsReceived,
      appealsOverturned: totals.appealsOverturned,
      appealOverturnRate: totals.appealsReceived > 0 
        ? totals.appealsOverturned / totals.appealsReceived 
        : 0,
    };
  }

  /**
   * Helper: Determine priority based on reason
   */
  private determinePriority(reason: ReportReason): PriorityLevel {
    const priorityMap = {
      [ReportReason.ILLEGAL_CONTENT]: PriorityLevel.CRITICAL,
      [ReportReason.SELF_HARM]: PriorityLevel.CRITICAL,
      [ReportReason.VIOLENCE]: PriorityLevel.HIGH,
      [ReportReason.HATE_SPEECH]: PriorityLevel.HIGH,
      [ReportReason.HARASSMENT]: PriorityLevel.HIGH,
      [ReportReason.NSFW]: PriorityLevel.MEDIUM,
      [ReportReason.SPAM]: PriorityLevel.LOW,
      [ReportReason.MISINFORMATION]: PriorityLevel.MEDIUM,
      [ReportReason.COPYRIGHT]: PriorityLevel.MEDIUM,
      [ReportReason.IMPERSONATION]: PriorityLevel.MEDIUM,
      [ReportReason.OTHER]: PriorityLevel.LOW,
    };

    return priorityMap[reason] || PriorityLevel.MEDIUM;
  }

  /**
   * Helper: Map action to status
   */
  private mapActionToStatus(action: ModerationAction): ModerationStatus {
    const statusMap = {
      [ModerationAction.APPROVE]: ModerationStatus.APPROVED,
      [ModerationAction.REMOVE]: ModerationStatus.REMOVED,
      [ModerationAction.WARN]: ModerationStatus.WARNED,
      [ModerationAction.BAN_USER]: ModerationStatus.REMOVED,
      [ModerationAction.ESCALATE]: ModerationStatus.ESCALATED,
      [ModerationAction.REQUEST_INFO]: ModerationStatus.IN_REVIEW,
    };

    return statusMap[action] || ModerationStatus.IN_REVIEW;
  }

  /**
   * Helper: Update moderator metrics
   */
  private async updateModeratorMetrics(
    moderatorId: string,
    action: ModerationAction,
    processingTime: number
  ): Promise<void> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let metrics = await this.metricsRepo.findOne({
      where: { moderatorId, date: today },
    });

    if (!metrics) {
      metrics = this.metricsRepo.create({
        moderatorId,
        date: today,
      });
    }

    metrics.totalReviewed += 1;

    // Update action counts
    if (action === ModerationAction.APPROVE) metrics.approved += 1;
    if (action === ModerationAction.REMOVE) metrics.removed += 1;
    if (action === ModerationAction.WARN) metrics.warned += 1;
    if (action === ModerationAction.ESCALATE) metrics.escalated += 1;

    // Update average processing time
    const totalTime = metrics.averageProcessingTimeSeconds * (metrics.totalReviewed - 1);
    metrics.averageProcessingTimeSeconds = Math.round(
      (totalTime + processingTime) / metrics.totalReviewed
    );

    await this.metricsRepo.save(metrics);
  }

  /**
   * Helper: Map to DTO
   */
  private mapToDto(item: ModerationQueue): ModerationQueueItemDto {
    const now = new Date();
    const createdAt = new Date(item.createdAt);
    const timeInQueue = Math.floor((now.getTime() - createdAt.getTime()) / 1000);

    return {
      id: item.id,
      contentType: item.contentType,
      contentId: item.contentId,
      reportedUserId: item.reportedUserId,
      reporterId: item.reporterId,
      reason: item.reason,
      description: item.description,
      status: item.status,
      priority: item.priority,
      assignedModeratorId: item.assignedModeratorId,
      contentSnapshot: item.contentSnapshot,
      isAutoFlagged: item.isAutoFlagged,
      reportCount: item.reportCount,
      createdAt: item.createdAt,
      assignedAt: item.assignedAt,
      timeInQueue,
    };
  }
}

// ============================================================================
// TEMPLATE SERVICE
// ============================================================================

@Injectable()
export class ModerationTemplateService {
  constructor(
    @InjectRepository(ModerationTemplate)
    private templateRepo: Repository<ModerationTemplate>,
  ) {}

  async getTemplates(action?: ModerationAction): Promise<ModerationTemplate[]> {
    const where: any = { isActive: true };
    if (action) {
      where.action = action;
    }

    return await this.templateRepo.find({ where });
  }

  async createTemplate(data: Partial<ModerationTemplate>): Promise<ModerationTemplate> {
    const template = this.templateRepo.create(data);
    return await this.templateRepo.save(template);
  }
}

// ============================================================================
// ANALYTICS SERVICE
// ============================================================================

import { Cron, CronExpression } from '@nestjs/schedule';

@Injectable()
export class ModerationAnalyticsService {
  private readonly logger = new Logger(ModerationAnalyticsService.name);

  constructor(
    @InjectRepository(ModerationQueue)
    private queueRepo: Repository<ModerationQueue>,
    @InjectRepository(ModerationAnalytics)
    private analyticsRepo: Repository<ModerationAnalytics>,
  ) {}

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async captureAnalytics(): Promise<void> {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    yesterday.setHours(0, 0, 0, 0);

    const endOfYesterday = new Date(yesterday);
    endOfYesterday.setHours(23, 59, 59, 999);

    const reports = await this.queueRepo.find({
      where: {
        createdAt: Between(yesterday, endOfYesterday) as any,
      },
    });

    const reportsByReason = {} as Record<ReportReason, number>;
    const reportsByContentType = {} as Record<ContentType, number>;
    let autoFlagged = 0;

    for (const report of reports) {
      reportsByReason[report.reason] = (reportsByReason[report.reason] || 0) + 1;
      reportsByContentType[report.contentType] = 
        (reportsByContentType[report.contentType] || 0) + 1;
      
      if (report.isAutoFlagged) autoFlagged++;
    }

    const resolved = reports.filter(r => r.resolvedAt).length;
    const pending = reports.filter(r => r.status === ModerationStatus.PENDING).length;

    const queueTimes = reports
      .filter(r => r.resolvedAt)
      .map(r => {
        const start = new Date(r.createdAt).getTime();
        const end = new Date(r.resolvedAt!).getTime();
        return (end - start) / 1000;
      });

    const averageQueueTime = queueTimes.length > 0
      ? Math.round(queueTimes.reduce((a, b) => a + b, 0) / queueTimes.length)
      : 0;

    const analytics = this.analyticsRepo.create({
      date: yesterday,
      totalReports: reports.length,
      autoFlagged,
      userReported: reports.length - autoFlagged,
      reportsByReason,
      reportsByContentType,
      averageQueueTime,
      pendingCount: pending,
      resolvedCount: resolved,
    });

    await this.analyticsRepo.save(analytics);

    this.logger.log(`Analytics captured for ${yesterday.toDateString()}`);
  }

  async getAnalytics(startDate: Date, endDate: Date): Promise<ModerationAnalytics[]> {
    return await this.analyticsRepo.find({
      where: {
        date: Between(startDate, endDate) as any,
      },
      order: { date: 'ASC' },
    });
  }
}

// ============================================================================
// CONTROLLER
// ============================================================================

import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';

@ApiTags('Admin - Moderation')
@Controller('admin/moderation')
@ApiBearerAuth()
// @UseGuards(AdminGuard) // Add your admin guard here
export class ModerationController {
  constructor(
    private readonly queueService: ModerationQueueService,
    private readonly templateService: ModerationTemplateService,
    private readonly analyticsService: ModerationAnalyticsService,
  ) {}

  @Get('queue')
  @ApiOperation({ summary: 'Get moderation queue' })
  async getQueue(@Query() filters: ModerationQueueFilterDto) {
    return await this.queueService.getQueue(filters);
  }

  @Post('queue/:id/assign')
  @ApiOperation({ summary: 'Assign moderator to queue item' })
  async assignModerator(
    @Param('id') id: string,
    @Body('moderatorId') moderatorId: string
  ) {
    return await this.queueService.assignModerator(id, moderatorId);
  }

  @Post('queue/:id/action')
  @ApiOperation({ summary: 'Take moderation action' })
  async takeModerationAction(
    @Param('id') id: string,
    @Body() dto: ModerationActionDto,
    @Request() req: any
  ) {
    const moderatorId = req.user.id;
    return await this.queueService.takeModerationAction(id, moderatorId, dto);
  }

  @Post('queue/batch')
  @ApiOperation({ summary: 'Batch moderation actions' })
  async batchModerationAction(
    @Body() dto: BatchModerationDto,
    @Request() req: any
  ) {
    const moderatorId = req.user.id;
    return await this.queueService.batchModerationAction(moderatorId, dto);
  }

  @Post('appeals')
  @ApiOperation({ summary: 'Create an appeal' })
  async createAppeal(@Body() dto: CreateAppealDto) {
    return await this.queueService.createAppeal(dto);
  }

  @Put('appeals/:id')
  @ApiOperation({ summary: 'Process appeal' })
  async processAppeal(
    @Param('id') id: string,
    @Body('approved') approved: boolean,
    @Body('reviewNotes') reviewNotes: string,
    @Request() req: any
  ) {
    const moderatorId = req.user.id;
    return await this.queueService.processAppeal(id, moderatorId, approved, reviewNotes);
  }

  @Get('metrics/:moderatorId')
  @ApiOperation({ summary: 'Get moderator performance metrics' })
  async getModeratorPerformance(
    @Param('moderatorId') moderatorId: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string
  ) {
    return await this.queueService.getModeratorPerformance(
      moderatorId,
      startDate ? new Date(startDate) : undefined,
      endDate ? new Date(endDate) : undefined
    );
  }

  @Get('templates')
  @ApiOperation({ summary: 'Get moderation templates' })
  async getTemplates(@Query('action') action?: ModerationAction) {
    return await this.templateService.getTemplates(action);
  }

  @Get('analytics')
  @ApiOperation({ summary: 'Get moderation analytics' })
  async getAnalytics(
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string
  ) {
    return await this.analyticsService.getAnalytics(
      new Date(startDate),
      new Date(endDate)
    );
  }
}

// ============================================================================
// MODULE
// ============================================================================

import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ModerationQueue,
      ModerationDecision,
      ModerationAppeal,
      ModerationTemplate,
      ModeratorMetrics,
      ModerationAnalytics,
    ]),
    ScheduleModule.forRoot(),
  ],
  controllers: [ModerationController],
  providers: [
    ModerationQueueService,
    AutoFlaggingService,
    ModerationTemplateService,
    ModerationAnalyticsService,
  ],
  exports: [ModerationQueueService, AutoFlaggingService],
})
export class ModerationModule {}

