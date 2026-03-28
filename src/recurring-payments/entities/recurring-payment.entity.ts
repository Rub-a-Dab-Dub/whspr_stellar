import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';

export enum PaymentFrequency {
  DAILY = 'DAILY',
  WEEKLY = 'WEEKLY',
  BIWEEKLY = 'BIWEEKLY',
  MONTHLY = 'MONTHLY',
}

export enum RecurringPaymentStatus {
  ACTIVE = 'ACTIVE',
  PAUSED = 'PAUSED',
  CANCELLED = 'CANCELLED',
  COMPLETED = 'COMPLETED',
}

@Entity('recurring_payments')
export class RecurringPayment {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  @Index('idx_rp_sender_id')
  senderId!: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'senderId' })
  sender!: User;

  @Column({ type: 'varchar', length: 56 })
  recipientAddress!: string;

  @Column({ type: 'uuid', nullable: true })
  tokenId!: string | null;

  @Column({ type: 'numeric', precision: 20, scale: 7 })
  amount!: string;

  @Column({ type: 'enum', enum: PaymentFrequency })
  frequency!: PaymentFrequency;

  @Column({ type: 'timestamp' })
  @Index('idx_rp_next_run_at')
  nextRunAt!: Date;

  @Column({ type: 'timestamp', nullable: true })
  lastRunAt!: Date | null;

  @Column({ type: 'int', default: 0 })
  totalRuns!: number;

  @Column({ type: 'int', nullable: true })
  maxRuns!: number | null;

  @Column({ type: 'int', default: 0 })
  consecutiveFailures!: number;

  @Column({
    type: 'enum',
    enum: RecurringPaymentStatus,
    default: RecurringPaymentStatus.ACTIVE,
  })
  @Index('idx_rp_status')
  status!: RecurringPaymentStatus;

  @CreateDateColumn({ type: 'timestamp' })
  createdAt!: Date;
}
