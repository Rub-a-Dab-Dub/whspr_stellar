import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';

export enum WithdrawalStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected',
  QUEUED = 'queued',
  COMPLETED = 'completed',
}

export enum ChainType {
  ETH = 'ETH',
  BSC = 'BSC',
  POLYGON = 'POLYGON',
  SOL = 'SOL',
  BTC = 'BTC',
}

@Entity('withdrawal_requests')
export class WithdrawalRequest {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id' })
  userId: string;

  @Column({ name: 'username' })
  username: string;

  @Column({ name: 'wallet_address' })
  walletAddress: string;

  @Column({ type: 'decimal', precision: 20, scale: 8 })
  amount: number;

  @Column({ type: 'enum', enum: ChainType })
  chain: ChainType;

  @Column({
    type: 'enum',
    enum: WithdrawalStatus,
    default: WithdrawalStatus.PENDING,
  })
  status: WithdrawalStatus;

  @Column({ name: 'risk_score', type: 'float', default: 0 })
  riskScore: number;

  @Column({ name: 'rejection_reason', nullable: true })
  rejectionReason: string;

  @Column({ name: 'reviewed_by', nullable: true })
  reviewedBy: string;

  @Column({ name: 'reviewed_at', nullable: true })
  reviewedAt: Date;

  @Column({ name: 'is_new_address', default: false })
  isNewAddress: boolean;

  @Column({ name: 'auto_approved', default: false })
  autoApproved: boolean;

  @Column({ name: 'tx_hash', nullable: true })
  txHash: string;

  @CreateDateColumn({ name: 'requested_at' })
  requestedAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
