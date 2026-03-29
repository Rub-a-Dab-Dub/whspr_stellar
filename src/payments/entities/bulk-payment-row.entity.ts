import { Entity, PrimaryGeneratedColumn, Column, Index, ManyToOne, JoinColumn, CreateDateColumn } from 'typeorm';
import { BulkPayment } from './bulk-payment.entity';
import { BulkPaymentRowStatus } from '../enums/bulk-payment-row-status.enum';

@Entity('bulk_payment_rows')
@Index(['bulkPaymentId', 'rowNumber'], 'idx_bulk_payment_rows_unique')
@Index('idx_bulk_payment_rows_status', ['status'])
export class BulkPaymentRow {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column()
  bulkPaymentId!: string;

  @ManyToOne(() => BulkPayment, { nullable: false })
  @JoinColumn({ name: 'bulkPaymentId' })
  bulkPayment!: BulkPayment;

  @Column()
  rowNumber!: number;

  @Column()
  toUsername!: string;

  @Column()
  amountUsdc!: string;

  @Column({ nullable: true })
  note?: string;

  @Column({ type: 'enum', enum: BulkPaymentRowStatus, default: BulkPaymentRowStatus.PENDING })
  status!: BulkPaymentRowStatus;

  @Column({ nullable: true })
  failureReason?: string;

  @Column({ nullable: true })
  txId?: string;

  @Column({ type: 'timestamp', nullable: true })
  processedAt?: Date;
}

