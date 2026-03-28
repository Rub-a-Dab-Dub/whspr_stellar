import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

export enum SandboxTransactionStatus {
  PENDING = 'PENDING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
}

export enum SandboxTransactionType {
  FRIEND_BOT_FUND = 'FRIEND_BOT_FUND',
  SANDBOX_TRANSFER = 'SANDBOX_TRANSFER',
}

@Entity('sandbox_transactions')
export class SandboxTransaction {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  @Index('idx_sandbox_transactions_environment_id')
  environmentId!: string;

  @Column({ type: 'uuid' })
  @Index('idx_sandbox_transactions_user_id')
  userId!: string;

  @Column({ type: 'varchar', length: 56 })
  @Index('idx_sandbox_transactions_wallet_address')
  walletAddress!: string;

  @Column({ type: 'varchar', length: 16, default: 'XLM' })
  asset!: string;

  @Column({ type: 'numeric', precision: 20, scale: 7, default: 0 })
  amount!: string;

  @Column({ type: 'varchar', length: 64, default: 'stellar_testnet' })
  network!: string;

  @Column({ type: 'varchar', length: 128, nullable: true })
  friendbotTxHash!: string | null;

  @Column({
    type: 'enum',
    enum: SandboxTransactionType,
    default: SandboxTransactionType.FRIEND_BOT_FUND,
  })
  type!: SandboxTransactionType;

  @Column({
    type: 'enum',
    enum: SandboxTransactionStatus,
    default: SandboxTransactionStatus.PENDING,
  })
  status!: SandboxTransactionStatus;

  @Column({ type: 'boolean', default: true })
  @Index('idx_sandbox_transactions_is_sandbox')
  isSandbox!: boolean;

  @Column({ type: 'text', nullable: true })
  errorMessage!: string | null;

  @CreateDateColumn({ type: 'timestamp' })
  createdAt!: Date;
}
