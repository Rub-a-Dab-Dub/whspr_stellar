import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { RecurringPayment } from './recurring-payment.entity';

export enum RunStatus {
  SUCCESS = 'SUCCESS',
  FAILED = 'FAILED',
  SKIPPED = 'SKIPPED',
}

@Entity('recurring_payment_runs')
export class RecurringPaymentRun {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  @Index('idx_rpr_recurring_payment_id')
  recurringPaymentId!: string;

  @ManyToOne(() => RecurringPayment, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'recurringPaymentId' })
  recurringPayment!: RecurringPayment;

  @Column({ type: 'varchar', length: 128, nullable: true })
  txHash!: string | null;

  @Column({ type: 'enum', enum: RunStatus })
  status!: RunStatus;

  @Column({ type: 'numeric', precision: 20, scale: 7 })
  amount!: string;

  @Column({ type: 'text', nullable: true })
  errorMessage!: string | null;

  @CreateDateColumn({ type: 'timestamp' })
  executedAt!: Date;
}
