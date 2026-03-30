import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';

export enum BlockchainTransactionType {
  DEPOSIT = 'deposit',
  WITHDRAWAL = 'withdrawal',
  TRANSFER = 'transfer',
  STAKE = 'stake',
  UNSTAKE = 'unstake',
  PAYLINK_PAYMENT = 'paylink_payment',
}

export enum BlockchainTransactionStatus {
  PENDING = 'pending',
  SUBMITTED = 'submitted',
  CONFIRMED = 'confirmed',
  FAILED = 'failed',
}

@Entity('blockchain_transactions')
@Index('idx_blockchain_tx_user_created', ['userId', 'createdAt'], { synchronize: false })
@Index('idx_blockchain_tx_status', ['status'])
@Index('idx_blockchain_tx_reference_id', ['referenceId'])
export class BlockchainTransaction {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  @Index('idx_blockchain_tx_user_id')
  userId!: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user!: User;

  @Column({
    type: 'enum',
    enum: BlockchainTransactionType,
  })
  @Index('idx_blockchain_tx_type')
  type!: BlockchainTransactionType;

  @Column({ type: 'varchar', length: 128, unique: true, nullable: true })
  @Index('idx_blockchain_tx_hash_unique')
  txHash!: string | null;

  @Column({
    type: 'enum',
    enum: BlockchainTransactionStatus,
    default: BlockchainTransactionStatus.PENDING,
  })
  status!: BlockchainTransactionStatus;

  @Column({ type: 'varchar', length: 128 })
  @Index('idx_blockchain_tx_from_address')
  fromAddress!: string;

  @Column({ type: 'varchar', length: 128, nullable: true })
  @Index('idx_blockchain_tx_to_address')
  toAddress!: string | null;

  @Column({ type: 'numeric', precision: 20, scale: 7 })
  amountUsdc!: string;

  @Column({ type: 'numeric', precision: 20, scale: 0, nullable: true })
  feeStroops!: string | null;

  @Column({ type: 'integer', nullable: true })
  ledger!: number | null;

  @Column({ type: 'text', nullable: true })
  errorMessage!: string | null;

  @Column({ type: 'varchar', length: 255 })
  @Index('idx_blockchain_tx_reference_id_unique', { unique: true })
  referenceId!: string;

  @CreateDateColumn({ type: 'timestamp' })
  createdAt!: Date;

  @Column({ type: 'timestamp', nullable: true })
  confirmedAt!: Date | null;

  @UpdateDateColumn({ type: 'timestamp' })
  updatedAt!: Date;
}
