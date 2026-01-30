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

export enum TransferStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
}

export enum TransferType {
  P2P = 'p2p',
  BULK = 'bulk',
}

@Entity('transfers')
@Index(['senderId', 'createdAt'])
@Index(['recipientId', 'createdAt'])
@Index(['status', 'createdAt'])
@Index(['transactionHash'])
export class Transfer {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'sender_id' })
  sender: User;

  @Column({ name: 'sender_id' })
  senderId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'recipient_id' })
  recipient: User;

  @Column({ name: 'recipient_id' })
  recipientId: string;

  @Column('decimal', { precision: 18, scale: 8 })
  amount: string;

  @Column({ name: 'blockchain_network', default: 'stellar' })
  blockchainNetwork: string;

  @Column({ name: 'transaction_hash', nullable: true, unique: true })
  transactionHash: string;

  @Column({
    type: 'enum',
    enum: TransferStatus,
    default: TransferStatus.PENDING,
  })
  status: TransferStatus;

  @Column({
    type: 'enum',
    enum: TransferType,
    default: TransferType.P2P,
  })
  type: TransferType;

  @Column({ type: 'text', nullable: true })
  memo: string;

  @Column({ type: 'text', nullable: true })
  note: string;

  @Column({ name: 'bulk_transfer_id', nullable: true })
  bulkTransferId: string;

  @Column({ name: 'sender_balance_before', type: 'decimal', precision: 18, scale: 8, nullable: true })
  senderBalanceBefore: string;

  @Column({ name: 'sender_balance_after', type: 'decimal', precision: 18, scale: 8, nullable: true })
  senderBalanceAfter: string;

  @Column({ name: 'recipient_balance_before', type: 'decimal', precision: 18, scale: 8, nullable: true })
  recipientBalanceBefore: string;

  @Column({ name: 'recipient_balance_after', type: 'decimal', precision: 18, scale: 8, nullable: true })
  recipientBalanceAfter: string;

  @Column({ name: 'failure_reason', type: 'text', nullable: true })
  failureReason: string;

  @Column({ name: 'retry_count', default: 0 })
  retryCount: number;

  @Column({ name: 'completed_at', type: 'timestamp', nullable: true })
  completedAt: Date;

  @Column({ name: 'failed_at', type: 'timestamp', nullable: true })
  failedAt: Date;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
