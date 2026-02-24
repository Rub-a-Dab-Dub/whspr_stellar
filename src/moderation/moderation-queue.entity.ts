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
  HIGH = 'high', // 4-8 hours
  MEDIUM = 'medium', // 24 hours
  LOW = 'low', // 48+ hours
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

  @Column({
    type: 'enum',
    enum: ModerationStatus,
    default: ModerationStatus.PENDING,
  })
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

  @OneToMany(() => ModerationDecision, (decision) => decision.queueItem)
  decisions: ModerationDecision[];

  @OneToMany(() => ModerationAppeal, (appeal) => appeal.queueItem)
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

  @ManyToOne(() => ModerationQueue, (queue) => queue.decisions)
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

  @ManyToOne(() => ModerationQueue, (queue) => queue.appeals)
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

