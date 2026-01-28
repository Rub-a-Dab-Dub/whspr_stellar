import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
  Index,
} from 'typeorm';
import { Notification } from './notification.entity';
import { NotificationBatchStatus } from '../enums/notification-batch-status.enum';

@Entity('notification_batches')
@Index(['status', 'scheduledFor'])
@Index(['createdAt'])
export class NotificationBatch {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 255 })
  name!: string;

  @Column({ type: 'text', nullable: true })
  description!: string | null;

  @Column({
    type: 'enum',
    enum: NotificationBatchStatus,
    default: NotificationBatchStatus.PENDING,
  })
  status!: NotificationBatchStatus;

  @Column({ type: 'int', default: 0 })
  totalNotifications!: number;

  @Column({ type: 'int', default: 0 })
  sentNotifications!: number;

  @Column({ type: 'int', default: 0 })
  failedNotifications!: number;

  @Column({ type: 'timestamp', nullable: true })
  scheduledFor!: Date | null;

  @Column({ type: 'timestamp', nullable: true })
  startedAt!: Date | null;

  @Column({ type: 'timestamp', nullable: true })
  completedAt!: Date | null;

  @Column({ type: 'jsonb', nullable: true })
  metadata!: Record<string, any>;

  @OneToMany(() => Notification, (notification) => notification.id)
  notifications!: Notification[];

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}