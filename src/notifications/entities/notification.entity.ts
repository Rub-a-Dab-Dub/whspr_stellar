import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  Index,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { NotificationType } from '../enums/notification-type.enum';
import { NotificationStatus } from '../enums/notification-status.enum';

@Entity('notifications')
@Index(['recipientId', 'createdAt'])
@Index(['recipientId', 'isRead'])
@Index(['type', 'recipientId'])
@Index(['status', 'recipientId'])
export class Notification {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column()
  recipientId!: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  recipient!: User;

  @Column({
    type: 'enum',
    enum: NotificationType,
  })
  @Index()
  type!: NotificationType;

  @Column({
    type: 'enum',
    enum: NotificationStatus,
    default: NotificationStatus.PENDING,
  })
  status!: NotificationStatus;

  @Column({ type: 'varchar', length: 255 })
  title!: string;

  @Column({ type: 'text' })
  message!: string;

  @Column({ type: 'jsonb', nullable: true })
  data!: Record<string, any>;

  @Column({ default: false })
  isRead!: boolean;

  @Column({ type: 'timestamp', nullable: true })
  readAt!: Date | null;

  @Column({ nullable: true })
  senderId!: string | null;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  sender!: User | null;

  @Column({ nullable: true })
  roomId!: string | null;

  @Column({ nullable: true })
  messageId!: string | null;

  @Column({ nullable: true })
  actionUrl!: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  category!: string | null;

  @Column({ default: 1 })
  priority!: number;

  @Column({ type: 'timestamp', nullable: true })
  scheduledFor!: Date | null;

  @Column({ type: 'timestamp', nullable: true })
  sentAt!: Date | null;

  @Column({ type: 'int', default: 0 })
  retryCount!: number;

  @Column({ type: 'text', nullable: true })
  errorMessage!: string | null;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}