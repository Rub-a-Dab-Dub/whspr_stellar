import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  OneToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';
import { Message } from '../../messages/entities/message.entity';
import { Transaction } from '../../transactions/entities/transaction.entity';
import { Conversation } from '../../conversations/entities/conversation.entity';
import { User } from '../../users/entities/user.entity';

export enum TransferStatus {
  PENDING_CONFIRMATION = 'pending_confirmation',
  CONFIRMED = 'confirmed',
  SUBMITTED = 'submitted',
  COMPLETED = 'completed',
  FAILED = 'failed',
}

export enum TransferCommandType {
  SEND = 'send',
  TIP = 'tip',
  SPLIT = 'split',
}

@Entity('in_chat_transfers')
export class InChatTransfer {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  @Index('idx_in_chat_transfers_conversation_id')
  conversationId!: string;

  @ManyToOne(() => Conversation, (conversation) => conversation.transfers, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'conversationId' })
  conversation!: Conversation;

  @Column({ type: 'uuid' })
  @Index('idx_in_chat_transfers_sender_id')
  senderId!: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'senderId' })
  sender!: User;

  @Column({ type: 'simple-array' })
  recipientIds!: string[];

  @Column({ type: 'simple-array' })
  recipientUsernames!: string[];

  @Column({
    type: 'enum',
    enum: TransferCommandType,
  })
  commandType!: TransferCommandType;

  @Column({ type: 'text' })
  rawCommand!: string;

  @Column({ type: 'numeric', precision: 20, scale: 7 })
  totalAmount!: string;

  @Column({ type: 'numeric', precision: 20, scale: 7 })
  amountPerRecipient!: string;

  @Column({ type: 'varchar', length: 16 })
  asset!: string;

  @Column({
    type: 'enum',
    enum: TransferStatus,
    default: TransferStatus.PENDING_CONFIRMATION,
  })
  status!: TransferStatus;

  @Column({ type: 'numeric', precision: 20, scale: 7 })
  feeEstimate!: string;

  @Column({ type: 'text', nullable: true })
  errorMessage!: string | null;

  @Column({ type: 'varchar', length: 128, nullable: true })
  sorobanTxHash!: string | null;

  @Column({ type: 'uuid', nullable: true })
  messageId!: string | null;

  @OneToOne(() => Message, (message) => message.transfer, { nullable: true })
  @JoinColumn({ name: 'messageId' })
  message!: Message | null;

  @Column({ type: 'uuid', nullable: true })
  transactionId!: string | null;

  @OneToOne(() => Transaction, (transaction) => transaction.transfer, { nullable: true })
  @JoinColumn({ name: 'transactionId' })
  transaction!: Transaction | null;

  @CreateDateColumn({ type: 'timestamp' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamp' })
  updatedAt!: Date;
}
