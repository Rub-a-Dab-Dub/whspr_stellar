import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  Index,
} from 'typeorm';
import { User } from '../../user/entities/user.entity';

export enum BroadcastStatus {
  SCHEDULED = 'scheduled',
  SENDING = 'sending',
  COMPLETE = 'complete',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
}

@Entity('broadcast_notifications')
@Index(['status', 'createdAt'])
@Index(['createdById'])
@Index(['scheduledAt'])
export class BroadcastNotification {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  jobId: string;

  @Column()
  title: string;

  @Column('text')
  body: string;

  @Column({
    type: 'enum',
    enum: ['announcement', 'maintenance', 'reward', 'custom'],
  })
  type: 'announcement' | 'maintenance' | 'reward' | 'custom';

  @Column('simple-array')
  channels: string[];

  @Column('jsonb')
  targetAudience: {
    scope: 'all' | 'filtered';
    filters?: {
      minLevel?: number;
      status?: string;
      joinedBefore?: string;
      roomIds?: string[];
    };
  };

  @Column({
    type: 'enum',
    enum: BroadcastStatus,
    default: BroadcastStatus.SCHEDULED,
  })
  status: BroadcastStatus;

  @Column({ nullable: true })
  scheduledAt?: Date;

  @Column({ nullable: true })
  sentAt?: Date;

  @Column({ type: 'int', default: 0 })
  estimatedRecipients: number;

  @Column({ type: 'int', default: 0 })
  deliveredCount: number;

  @Column('uuid')
  createdById: string;

  @ManyToOne(() => User)
  createdBy: User;

  @Column('jsonb', { nullable: true })
  metadata?: Record<string, any>;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
