import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
  OneToOne,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { InChatTransfer } from '../../in-chat-transfers/entities/in-chat-transfer.entity';

export enum TransactionStatus {
  SUBMITTED = 'submitted',
  COMPLETED = 'completed',
  FAILED = 'failed',
}

@Entity('transactions')
export class Transaction {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  @Index('idx_transactions_sender_id')
  senderId!: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'senderId' })
  sender!: User;

  @Column({ type: 'varchar', length: 16 })
  asset!: string;

  @Column({ type: 'numeric', precision: 20, scale: 7 })
  totalAmount!: string;

  @Column({
    type: 'enum',
    enum: TransactionStatus,
    default: TransactionStatus.SUBMITTED,
  })
  status!: TransactionStatus;

  @Column({ type: 'varchar', length: 128, nullable: true })
  txHash!: string | null;

  @Column({ type: 'text', nullable: true })
  errorMessage!: string | null;

  @OneToOne(() => InChatTransfer, (transfer) => transfer.transaction)
  transfer!: InChatTransfer | null;

  @CreateDateColumn({ type: 'timestamp' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamp' })
  updatedAt!: Date;
}
