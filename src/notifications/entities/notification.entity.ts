import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

export enum InAppNotificationType {
  NEW_MESSAGE = 'NEW_MESSAGE',
  TRANSFER_RECEIVED = 'TRANSFER_RECEIVED',
  GROUP_INVITE = 'GROUP_INVITE',
  CONTACT_REQUEST = 'CONTACT_REQUEST',
  PROPOSAL_VOTE = 'PROPOSAL_VOTE',
  TRANSACTION_CONFIRMED = 'TRANSACTION_CONFIRMED',
  GROUP_EVENT = 'GROUP_EVENT',
  EVENT_REMINDER = 'EVENT_REMINDER',
}

@Entity('notifications')
@Index('idx_notifications_user_created', ['userId', 'createdAt'])
@Index('idx_notifications_user_is_read', ['userId', 'isRead'])
export class Notification {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  userId!: string;

  @Column({ type: 'enum', enum: InAppNotificationType })
  @Index('idx_notifications_type')
  type!: InAppNotificationType;

  @Column({ type: 'varchar', length: 160 })
  title!: string;

  @Column({ type: 'text' })
  body!: string;

  @Column({ type: 'jsonb', nullable: true })
  data!: Record<string, unknown> | null;

  @Column({ type: 'boolean', default: false })
  isRead!: boolean;

  @Column({ type: 'timestamp', nullable: true })
  readAt!: Date | null;

  @CreateDateColumn({ type: 'timestamp' })
  createdAt!: Date;

  @DeleteDateColumn({ type: 'timestamp', nullable: true })
  deletedAt!: Date | null;
}
