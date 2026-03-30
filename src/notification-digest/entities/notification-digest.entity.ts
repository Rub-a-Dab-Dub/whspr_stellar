import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

export enum DigestPeriod {
  HOURLY = 'HOURLY',
  DAILY = 'DAILY',
}

@Entity('notification_digests')
@Index('idx_digest_user_scheduled', ['userId', 'scheduledFor'])
@Index('idx_digest_user_sent', ['userId', 'summarySent'])
export class NotificationDigest {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  userId!: string;

  @Column({ type: 'enum', enum: DigestPeriod })
  period!: DigestPeriod;

  @Column({ type: 'simple-array', nullable: true })
  notificationIds!: string[];

  @Column({ type: 'boolean', default: false })
  summarySent!: boolean;

  @Column({ type: 'timestamp' })
  scheduledFor!: Date;

  @Column({ type: 'timestamp', nullable: true })
  sentAt!: Date | null;

  @CreateDateColumn({ type: 'timestamp' })
  createdAt!: Date;
}
