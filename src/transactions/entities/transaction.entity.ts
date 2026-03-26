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
  Index,
} from 'typeorm';

export enum TransactionStatus {
  PENDING = 'PENDING',
  CONFIRMED = 'CONFIRMED',
  FAILED = 'FAILED',
}

export enum TransactionType {
  TRANSFER = 'TRANSFER',
  TIP = 'TIP',
  SPLIT = 'SPLIT',
  TREASURY = 'TREASURY',
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
  @Column({ type: 'varchar', length: 128, unique: true })
  @Index('idx_transactions_tx_hash')
  txHash!: string;

  @Column({ type: 'varchar', length: 128 })
  @Index('idx_transactions_from_address')
  fromAddress!: string;

  @Column({ type: 'varchar', length: 128 })
  @Index('idx_transactions_to_address')
  toAddress!: string;

  @Column({ type: 'varchar', length: 128 })
  @Index('idx_transactions_token_id')
  tokenId!: string;

  @Column({ type: 'numeric', precision: 38, scale: 18, default: 0 })
  amount!: string;

  @Column({ type: 'numeric', precision: 38, scale: 18, default: 0 })
  fee!: string;

  @Column({ type: 'enum', enum: TransactionStatus, default: TransactionStatus.PENDING })
  @Index('idx_transactions_status')
  status!: TransactionStatus;

  @Column({ type: 'enum', enum: TransactionType })
  @Index('idx_transactions_type')
  type!: TransactionType;

  @Column({ type: 'uuid', nullable: true })
  @Index('idx_transactions_conversation_id')
  conversationId!: string | null;

  @Column({ type: 'uuid', nullable: true })
  @Index('idx_transactions_message_id')
  messageId!: string | null;

  @Column({ type: 'varchar', length: 64 })
  @Index('idx_transactions_network')
  network!: string;

  @Column({ type: 'varchar', length: 64, nullable: true })
  ledger!: string | null;

  @Column({ type: 'text', nullable: true })
  failureReason!: string | null;

  @Column({ type: 'timestamp', nullable: true })
  confirmedAt!: Date | null;

  @CreateDateColumn({ type: 'timestamp' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamp' })
  updatedAt!: Date;
}
