import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { WalletNetwork } from '../../wallets/entities/wallet.entity';

@Entity('saved_addresses')
export class SavedAddress {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  @Index('idx_saved_addresses_user_id')
  userId!: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user!: User;

  @Column({ type: 'varchar', length: 56 })
  @Index('idx_saved_addresses_wallet_address')
  walletAddress!: string;

  @Column({ type: 'varchar', length: 64 })
  alias!: string;

  @Column({ type: 'text', nullable: true })
  avatarUrl!: string | null;

  @Column({
    type: 'enum',
    enum: WalletNetwork,
    default: WalletNetwork.STELLAR_MAINNET,
  })
  network!: WalletNetwork;

  @Column({ type: 'text', array: true, default: '{}' })
  tags!: string[];

  @Column({ type: 'timestamp', nullable: true })
  lastUsedAt!: Date | null;

  @Column({ type: 'integer', default: 0 })
  usageCount!: number;

  @CreateDateColumn({ type: 'timestamp' })
  createdAt!: Date;
}
