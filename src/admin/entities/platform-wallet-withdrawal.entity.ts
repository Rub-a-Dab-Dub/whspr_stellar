import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

export enum WithdrawalStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
}

@Entity('platform_wallet_withdrawals')
export class PlatformWalletWithdrawal {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 50 })
  @Index()
  chain: string;

  @Column('decimal', { precision: 18, scale: 8 })
  amount: string;

  @Column({ type: 'varchar', length: 255 })
  toAddress: string;

  @Column({ type: 'text', nullable: true })
  reason: string;

  @Column({
    type: 'enum',
    enum: WithdrawalStatus,
    default: WithdrawalStatus.PENDING,
  })
  @Index()
  status: WithdrawalStatus;

  @Column({ type: 'varchar', length: 255, nullable: true })
  transactionHash: string;

  @Column({ type: 'uuid' })
  initiatedBy: string;

  @Column({ type: 'text', nullable: true })
  failureReason: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  jobId: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @Column({ type: 'timestamp', nullable: true })
  completedAt: Date;

  @Column({ type: 'timestamp', nullable: true })
  failedAt: Date;
}
