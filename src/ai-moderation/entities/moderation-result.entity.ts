import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export enum ModerationTargetType {
  MESSAGE = 'message',
  USER = 'user',
  PROFILE = 'profile',
  IMAGE = 'image',
}

export enum ModerationAction {
  NONE = 'NONE',
  WARN = 'WARN',
  HIDE = 'HIDE',
  DELETE = 'DELETE',
}

export enum ModerationReviewStatus {
  NOT_REQUIRED = 'NOT_REQUIRED',
  PENDING = 'PENDING',
  REVIEWED = 'REVIEWED',
}

@Entity('moderation_results')
export class ModerationResult {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({
    type: 'enum',
    enum: ModerationTargetType,
  })
  @Index('idx_moderation_results_target_type')
  targetType!: ModerationTargetType;

  @Column({ type: 'uuid' })
  @Index('idx_moderation_results_target_id')
  targetId!: string;

  @Column({ type: 'boolean', default: false })
  @Index('idx_moderation_results_flagged')
  flagged!: boolean;

  @Column({ type: 'jsonb', default: {} })
  categories!: Record<string, number>;

  @Column({ type: 'float', default: 0 })
  confidence!: number;

  @Column({ type: 'boolean', default: false })
  aiFlagged!: boolean;

  @Column({ type: 'float', default: 0 })
  aiConfidence!: number;

  @Column({
    type: 'enum',
    enum: ModerationAction,
    default: ModerationAction.NONE,
  })
  @Index('idx_moderation_results_action')
  action!: ModerationAction;

  @Column({
    type: 'enum',
    enum: ModerationAction,
    default: ModerationAction.NONE,
  })
  aiAction!: ModerationAction;

  @Column({
    type: 'enum',
    enum: ModerationReviewStatus,
    default: ModerationReviewStatus.NOT_REQUIRED,
  })
  @Index('idx_moderation_results_review_status')
  reviewStatus!: ModerationReviewStatus;

  @Column({ type: 'boolean', default: true })
  reviewedByAI!: boolean;

  @Column({ type: 'boolean', default: false })
  reviewedByHuman!: boolean;

  @Column({ type: 'text', nullable: true })
  overrideReason!: string | null;

  @Column({ type: 'varchar', length: 50, nullable: true })
  provider!: string | null;

  @Column({ type: 'jsonb', default: {} })
  metadata!: Record<string, unknown>;

  @Column({ type: 'timestamp', nullable: true })
  humanReviewQueuedAt!: Date | null;

  @Column({ type: 'timestamp', nullable: true })
  humanReviewedAt!: Date | null;

  @Column({ type: 'timestamp', nullable: true })
  feedbackTrainedAt!: Date | null;

  @CreateDateColumn({ type: 'timestamp' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamp' })
  updatedAt!: Date;
}
