import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
  Unique,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';

export enum WalletNetwork {
  STELLAR_MAINNET = 'stellar_mainnet',
  STELLAR_TESTNET = 'stellar_testnet',
}

@Entity('wallets')
@Unique('uq_wallets_user_address', ['userId', 'walletAddress'])
export class Wallet {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  @Index('idx_wallets_user_id')
  userId!: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user!: User;

  @Column({ type: 'varchar', length: 56 })
  @Index('idx_wallets_address')
  walletAddress!: string;

  @Column({
    type: 'enum',
    enum: WalletNetwork,
    default: WalletNetwork.STELLAR_MAINNET,
  })
  network!: WalletNetwork;

  @Column({ type: 'boolean', default: false })
  isVerified!: boolean;

  @Column({ type: 'boolean', default: false })
  @Index('idx_wallets_is_primary')
  isPrimary!: boolean;

  @Column({ type: 'varchar', length: 100, nullable: true })
  label!: string | null;

  @CreateDateColumn({ type: 'timestamp' })
  createdAt!: Date;
}
