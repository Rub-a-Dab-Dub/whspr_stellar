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

/** On-chain / receipt lifecycle */
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

  /** Populated for in-chat Soroban transfer rows */
  @Column({ type: 'uuid', nullable: true })
  @Index('idx_transactions_sender_id')
  senderId!: string | null;

  @ManyToOne(() => User, { onDelete: 'CASCADE', nullable: true })
  @JoinColumn({ name: 'senderId' })
  sender!: User | null;

  @Column({ type: 'varchar', length: 16, nullable: true })
  asset!: string | null;

  @Column({ type: 'numeric', precision: 20, scale: 7, nullable: true })
  totalAmount!: string | null;

  @Column({ type: 'varchar', length: 128, nullable: true })
  @Index('idx_transactions_tx_hash')
  txHash!: string | null;

  @Column({ type: 'varchar', length: 128, nullable: true })
  @Index('idx_transactions_from_address')
  fromAddress!: string | null;

  @Column({ type: 'varchar', length: 128, nullable: true })
  @Index('idx_transactions_to_address')
  toAddress!: string | null;

  @Column({ type: 'varchar', length: 128, nullable: true })
  @Index('idx_transactions_token_id')
  tokenId!: string | null;

  @Column({ type: 'numeric', precision: 38, scale: 18, nullable: true, default: '0' })
  amount!: string | null;

  @Column({ type: 'numeric', precision: 38, scale: 18, nullable: true, default: '0' })
  fee!: string | null;

  @Column({ type: 'enum', enum: TransactionStatus, default: TransactionStatus.PENDING })
  @Index('idx_transactions_status')
  status!: TransactionStatus;

  @Column({ type: 'enum', enum: TransactionType, nullable: true })
  @Index('idx_transactions_type')
  type!: TransactionType | null;

  @Column({ type: 'uuid', nullable: true })
  conversationId!: string | null;

  @Column({ type: 'uuid', nullable: true })
  messageId!: string | null;

  @Column({ type: 'varchar', length: 64, nullable: true })
  network!: string | null;

  @Column({ type: 'varchar', length: 64, nullable: true })
  ledger!: string | null;

  @Column({ type: 'text', nullable: true })
  failureReason!: string | null;

  @Column({ type: 'text', nullable: true })
  errorMessage!: string | null;

  @Column({ type: 'timestamp', nullable: true })
  confirmedAt!: Date | null;

  @OneToOne(() => InChatTransfer, (transfer) => transfer.transaction, { nullable: true })
  transfer!: InChatTransfer | null;

  @CreateDateColumn({ type: 'timestamp' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamp' })
  updatedAt!: Date;
}
