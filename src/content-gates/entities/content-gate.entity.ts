import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { WalletNetwork } from '../../wallets/entities/wallet.entity';

export enum GatedContentType {
  MESSAGE = 'MESSAGE',
  THREAD = 'THREAD',
  CHANNEL = 'CHANNEL',
  FILE = 'FILE',
}

export enum GateType {
  FUNGIBLE = 'FUNGIBLE',
  NFT = 'NFT',
  STAKING_TIER = 'STAKING_TIER',
}

@Entity('content_gates')
@Index('idx_content_gates_target', ['contentType', 'contentId', 'isActive'])
export class ContentGate {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({
    type: 'enum',
    enum: GatedContentType,
  })
  contentType!: GatedContentType;

  @Column({ type: 'varchar', length: 128 })
  contentId!: string;

  @Column({ type: 'uuid' })
  createdBy!: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'createdBy' })
  creator!: User;

  @Column({
    type: 'enum',
    enum: GateType,
  })
  gateType!: GateType;

  /**
   * FUNGIBLE/NFT: `CODE:ISSUER` or `native` / `XLM`.
   * STAKING_TIER: minimum {@link UserTier} name, e.g. `gold`.
   */
  @Column({ type: 'varchar', length: 256 })
  gateToken!: string;

  /** Minimum balance (fungible / NFT) as decimal string; ignored for staking tier. */
  @Column({ type: 'varchar', length: 64, default: '0' })
  minBalance!: string;

  @Column({
    type: 'enum',
    enum: WalletNetwork,
    default: WalletNetwork.STELLAR_MAINNET,
  })
  network!: WalletNetwork;

  @Column({ default: true })
  @Index('idx_content_gates_active')
  isActive!: boolean;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;
}
