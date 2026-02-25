import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

export enum PaymentType {
  P2P = 'P2P',
  TIP = 'TIP',
}

export enum PaymentStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  VERIFIED = 'verified',
  FAILED = 'failed',
  REFUNDED = 'refunded',
}

@Entity('payments')
@Index(['senderId', 'createdAt'])
@Index(['recipientId', 'createdAt'])
@Index(['transactionHash'])
export class Payment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne('User', { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'sender_id' })
  sender: unknown;

  @Column({ name: 'sender_id' })
  senderId: string;

  @ManyToOne('User', { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'recipient_id' })
  recipient: unknown | null;

  @Column({ name: 'recipient_id', nullable: true })
  recipientId: string | null;

  @Column({ name: 'recipient_wallet_address', length: 56 })
  recipientWalletAddress: string;

  @Column('decimal', { precision: 18, scale: 8 })
  amount: string;

  @Column({ name: 'token_address', length: 56, nullable: true })
  tokenAddress: string | null;

  @Column({ name: 'transaction_hash', nullable: true, unique: true })
  transactionHash: string | null;

  @Column({
    type: 'enum',
    enum: PaymentType,
    default: PaymentType.P2P,
  })
  type: PaymentType;

  @Column({
    type: 'enum',
    enum: PaymentStatus,
    default: PaymentStatus.PENDING,
  })
  status: PaymentStatus;

  @Column({ name: 'failure_reason', type: 'text', nullable: true })
  failureReason: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @Column({ name: 'completed_at', type: 'timestamp', nullable: true })
  completedAt: Date | null;
}
