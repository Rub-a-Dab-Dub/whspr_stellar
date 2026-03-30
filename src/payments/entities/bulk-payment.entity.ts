import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index, ManyToOne, OneToMany, JoinColumn } from 'typeorm';
import { User } from '../../../users/entities/user.entity';
import { BulkPaymentRow } from './bulk-payment-row.entity';
import { BulkPaymentStatus } from '../enums/bulk-payment-status.enum';

@Entity('bulk_payments')
@Index('idx_bulk_payments_initiated_by', ['initiatedById'])
@Index('idx_bulk_payments_status', ['status'])
export class BulkPayment {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column()
  initiatedById!: string;

  @ManyToOne(() => User, { nullable: false })
  @JoinColumn({ name: 'initiatedById' })
  initiatedBy!: User;

  @Column({ length: 100 })
  label!: string;

  @Column({ length: 255 })
  csvKey!: string; // R2 object key

  @Column()
  totalRows!: number;

  @Column({ default: 0 })
  successCount!: number;

  @Column({ default: 0 })
  failureCount!: number;

  @Column()
  totalAmountUsdc!: string; // string for precision

  @Column({ type: 'enum', enum: BulkPaymentStatus, default: BulkPaymentStatus.PENDING })
  status!: BulkPaymentStatus;

  @CreateDateColumn()
  createdAt!: Date;

  @Column({ type: 'timestamp', nullable: true })
  pinVerifiedAt?: Date;

  @Column({ type: 'timestamp', nullable: true })
  completedAt?: Date;

  @OneToMany(() => BulkPaymentRow, row => row.bulkPayment, { cascade: true })
  rows!: BulkPaymentRow[];
}

