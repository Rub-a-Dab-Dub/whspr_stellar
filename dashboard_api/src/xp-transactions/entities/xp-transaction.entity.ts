// src/xp-transactions/entities/xp-transaction.entity.ts
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';

export enum ActionType {
  MESSAGE = 'message',
  REACTION = 'reaction',
  GIFT = 'gift',
  TOKEN_SEND = 'token_send',
  SECRET_SHARE = 'secret_share',
  MANUAL_AWARD = 'manual_award',
  ADJUSTMENT = 'adjustment',
}

export enum TransactionStatus {
  ACTIVE = 'active',
  VOIDED = 'voided',
}

@Entity('xp_transactions')
@Index(['userId', 'createdAt'])
@Index(['actionType', 'createdAt'])
@Index(['status', 'createdAt'])
@Index(['amount'])
export class XPTransaction {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  @Index()
  userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  user: User;

  @Column({ type: 'enum', enum: ActionType })
  actionType: ActionType;

  @Column({ type: 'int' })
  amount: number;

  @Column({ type: 'decimal', precision: 5, scale: 2, default: 1.0 })
  multiplier: number;

  @Column({ type: 'int' })
  finalAmount: number; // amount * multiplier

  @Column({ type: 'enum', enum: TransactionStatus, default: TransactionStatus.ACTIVE })
  status: TransactionStatus;

  @Column({ type: 'text', nullable: true })
  reason: string;

  @Column({ type: 'uuid', nullable: true })
  @Index()
  transactionId: string; // External transaction reference (blockchain, etc.)

  @Column({ type: 'uuid', nullable: true })
  adjustedBy: string; // Admin user ID who made adjustment

  @Column({ type: 'uuid', nullable: true })
  voidedBy: string; // Admin user ID who voided

  @Column({ type: 'text', nullable: true })
  voidReason: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, any>; // Additional context
}
