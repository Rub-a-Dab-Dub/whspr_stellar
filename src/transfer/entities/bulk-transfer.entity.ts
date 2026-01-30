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

export enum BulkTransferStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  PARTIALLY_COMPLETED = 'partially_completed',
  FAILED = 'failed',
}

@Entity('bulk_transfers')
@Index(['senderId', 'createdAt'])
@Index(['status', 'createdAt'])
export class BulkTransfer {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'sender_id' })
  sender: User;

  @Column({ name: 'sender_id' })
  senderId: string;

  @Column('int', { name: 'total_recipients' })
  totalRecipients: number;

  @Column('decimal', { precision: 18, scale: 8, name: 'total_amount' })
  totalAmount: string;

  @Column('int', { name: 'successful_transfers', default: 0 })
  successfulTransfers: number;

  @Column('int', { name: 'failed_transfers', default: 0 })
  failedTransfers: number;

  @Column({
    type: 'enum',
    enum: BulkTransferStatus,
    default: BulkTransferStatus.PENDING,
  })
  status: BulkTransferStatus;

  @Column({ name: 'blockchain_network', default: 'stellar' })
  blockchainNetwork: string;

  @Column({ type: 'text', nullable: true })
  memo: string;

  @Column({ name: 'completed_at', type: 'timestamp', nullable: true })
  completedAt: Date;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
