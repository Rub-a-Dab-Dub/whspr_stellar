import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  ManyToOne,
  Index,
} from 'typeorm';
import { BroadcastNotification } from './broadcast-notification.entity';
import { User } from '../../user/entities/user.entity';

export enum DeliveryStatus {
  PENDING = 'pending',
  SENT = 'sent',
  FAILED = 'failed',
  OPENED = 'opened',
}

export enum DeliveryChannel {
  IN_APP = 'in_app',
  EMAIL = 'email',
  PUSH = 'push',
}

@Entity('notification_deliveries')
@Index(['broadcastId', 'userId'])
@Index(['broadcastId', 'channel', 'status'])
@Index(['broadcastId', 'createdAt'])
@Index(['userId', 'broadcastId'])
export class NotificationDelivery {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  broadcastId: string;

  @ManyToOne(() => BroadcastNotification, { onDelete: 'CASCADE' })
  broadcast: BroadcastNotification;

  @Column()
  userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  user: User;

  @Column({
    type: 'enum',
    enum: DeliveryChannel,
  })
  channel: DeliveryChannel;

  @Column({
    type: 'enum',
    enum: DeliveryStatus,
    default: DeliveryStatus.PENDING,
  })
  status: DeliveryStatus;

  @Column({ nullable: true })
  failureReason?: string;

  @Column({ nullable: true })
  sentAt?: Date;

  @Column({ nullable: true })
  openedAt?: Date;

  @CreateDateColumn()
  createdAt: Date;
}
