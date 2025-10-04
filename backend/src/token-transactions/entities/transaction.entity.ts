import { User } from 'src/users/entities/user.entity';
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  Index,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

export enum TransactionStatus {
  PENDING = 'PENDING',
  CONFIRMED = 'CONFIRMED',
  FAILED = 'FAILED',
  REVERSED = 'REVERSED',
  DISPUTED = 'DISPUTED',
  VOIDED = 'VOIDED',
}

@Entity({ name: 'token_transactions' })
@Index(['txHash'], { unique: true, where: '"txHash" IS NOT NULL' })
export class Transaction {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  // business id: internal trace id
  @Column({ type: 'varchar', length: 100, unique: true })
  traceId!: string;

  @ManyToOne(() => User, { nullable: true })
  sender?: User;

  @ManyToOne(() => User, { nullable: true })
  receiver?: User;

  @Column({ type: 'numeric', precision: 30, scale: 8, default: 0 })
  amount!: string; // stored as numeric string (ether / token units)

  @Column({ type: 'varchar', length: 64, nullable: true })
  tokenSymbol?: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  txHash?: string;

  @Column({ type: 'enum', enum: TransactionStatus, default: TransactionStatus.PENDING })
  status!: TransactionStatus;

  @Column({ type: 'jsonb', nullable: true })
  meta?: Record<string, any>; // chatId, roomId, messageId, reason, fee, gasUsed etc.

  @Column({ type: 'boolean', default: false })
  flaggedFraud?: boolean;

  @Column({ type: 'timestamp with time zone', nullable: true })
  confirmedAt?: Date;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;
}
