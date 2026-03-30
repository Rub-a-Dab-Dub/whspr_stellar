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
import { Conversation } from '../../conversations/entities/conversation.entity';
import { User } from '../../users/entities/user.entity';
import { InChatTransfer } from '../../in-chat-transfers/entities/in-chat-transfer.entity';

export enum PaymentRequestStatus {
  PENDING = 'PENDING',
  PAID = 'PAID',
  DECLINED = 'DECLINED',
  EXPIRED = 'EXPIRED',
  CANCELLED = 'CANCELLED',
}

@Entity('payment_requests')
@Index('idx_payment_requests_conversation_id_status', ['conversationId', 'status'])
@Index('idx_payment_requests_requester_id', ['requesterId'])
@Index('idx_payment_requests_payer_id', ['payerId'])
export class PaymentRequest {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  requesterId!: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'requesterId' })
  requester!: User;

  @Column({ type: 'uuid' })
  payerId!: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'payerId' })
  payer!: User;

  @Column({ type: 'uuid' })
  conversationId!: string;

  @ManyToOne(() => Conversation, (conv) => conv.paymentRequests, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'conversationId' })
  conversation!: Conversation;

  @Column({ type: 'varchar', length: 12 })
  asset!: string; // tokenId simplified to asset code like 'XLM', 'USDC'

  @Column({ type: 'numeric', precision: 20, scale: 7 })
  amount!: string;

  @Column({ type: 'text', nullable: true })
  note?: string;

  @Column({
    type: 'enum',
    enum: PaymentRequestStatus,
    default: PaymentRequestStatus.PENDING,
  })
  status!: PaymentRequestStatus;

  @Column({ type: 'timestamp', nullable: true })
  expiresAt?: Date;

  @Column({ type: 'timestamp', nullable: true })
  paidAt?: Date;

  @Column({ type: 'uuid', nullable: true })
  transferId?: string; // link to InChatTransfer on accept

  @OneToOne(() => InChatTransfer, (transfer) => transfer.paymentRequest, { nullable: true })
  @JoinColumn({ name: 'transferId' })
  transfer?: InChatTransfer;

  @CreateDateColumn({ type: 'timestamp' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamp' })
  updatedAt!: Date;
}
