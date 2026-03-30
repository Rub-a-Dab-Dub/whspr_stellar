import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

export enum FeedbackType {
  BUG = 'BUG',
  FEEDBACK = 'FEEDBACK',
  FEATURE_REQUEST = 'FEATURE_REQUEST',
}

export enum FeedbackStatus {
  NEW = 'NEW',
  IN_REVIEW = 'IN_REVIEW',
  RESOLVED = 'RESOLVED',
  CLOSED = 'CLOSED',
}

export enum FeedbackPriority {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
}

@Entity('feedback_reports')
@Index('idx_feedback_type_status', ['type', 'status'])
@Index('idx_feedback_status_priority_created', ['status', 'priority', 'createdAt'])
@Index('idx_feedback_userId', ['userId'])
export class FeedbackReport {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', nullable: true })
  userId?: string; // optional for anonymous

  @Column({
    type: 'enum',
    enum: FeedbackType,
    default: FeedbackType.FEEDBACK,
  })
  type!: FeedbackType;

  @Column({ type: 'varchar', length: 255 })
  title!: string;

  @Column({ type: 'text' })
  description!: string;

  @Column({ type: 'varchar', length: 2048, nullable: true })
  screenshotUrl?: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  appVersion?: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  platform?: string;

  @Column({ type: 'jsonb', nullable: true })
  deviceInfo?: Record<string, any>;

  @Column({
    type: 'enum',
    enum: FeedbackStatus,
    default: FeedbackStatus.NEW,
  })
  status!: FeedbackStatus;

  @Column({
    type: 'enum',
    enum: FeedbackPriority,
    default: FeedbackPriority.MEDIUM,
  })
  priority!: FeedbackPriority;

  @CreateDateColumn({ type: 'timestamp' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamp' })
  updatedAt!: Date;
}
