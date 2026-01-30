import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { User } from '../../user/entities/user.entity';

export enum ScheduledTransferStatus {
  PENDING = 'pending',
  EXECUTED = 'executed',
  CANCELLED = 'cancelled',
  FAILED = 'failed',
}

export enum RecurrenceFrequency {
  DAILY = 'daily',
  WEEKLY = 'weekly',
  BIWEEKLY = 'biweekly',
  MONTHLY = 'monthly',
  QUARTERLY = 'quarterly',
  YEARLY = 'yearly',
}

@Entity('scheduled_transfers')
@Index(['senderId', 'scheduledDate'])
@Index(['status', 'scheduledDate'])
@Index(['isRecurring', 'nextExecutionDate'])
export class ScheduledTransfer {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'sender_id' })
  sender: User;

  @Column({ name: 'sender_id' })
  senderId: string;

  @Column({ name: 'recipient_id' })
  recipientId: string;

  @Column('decimal', { precision: 18, scale: 8 })
  amount: string;

  @Column({ name: 'blockchain_network', default: 'stellar' })
  blockchainNetwork: string;

  @Column({ type: 'text', nullable: true })
  memo: string;

  @Column({ type: 'text', nullable: true })
  note: string;

  @Column({ name: 'scheduled_date', type: 'timestamp' })
  scheduledDate: Date;

  @Column({ name: 'is_recurring', default: false })
  isRecurring: boolean;

  @Column({
    type: 'enum',
    enum: RecurrenceFrequency,
    nullable: true,
  })
  recurrenceFrequency: RecurrenceFrequency;

  @Column({ name: 'recurrence_end_date', type: 'timestamp', nullable: true })
  recurrenceEndDate: Date;

  @Column({ name: 'next_execution_date', type: 'timestamp', nullable: true })
  nextExecutionDate: Date;

  @Column({ name: 'execution_count', default: 0 })
  executionCount: number;

  @Column({ name: 'max_executions', nullable: true })
  maxExecutions: number;

  @Column({
    type: 'enum',
    enum: ScheduledTransferStatus,
    default: ScheduledTransferStatus.PENDING,
  })
  status: ScheduledTransferStatus;

  @Column({ name: 'last_transfer_id', nullable: true })
  lastTransferId: string;

  @Column({ name: 'executed_at', type: 'timestamp', nullable: true })
  executedAt: Date;

  @Column({ name: 'cancelled_at', type: 'timestamp', nullable: true })
  cancelledAt: Date;

  @Column({ name: 'cancelled_by', nullable: true })
  cancelledBy: string;

  @Column({ name: 'cancellation_reason', type: 'text', nullable: true })
  cancellationReason: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
