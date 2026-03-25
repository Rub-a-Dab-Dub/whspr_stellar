import { User } from '../../users/entities/user.entity';
import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { WalletNetwork } from '../../wallets/entities/wallet.entity';

@Entity('nfts')
@Index('IDX_NFTS_ASSET', ['network', 'contractAddress', 'tokenId'], {
  unique: true,
})
export class NFT {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column()
  contractAddress!: string;

  @Column()
  tokenId!: string;

  @Column({ type: 'uuid', nullable: true })
  @Index('IDX_NFTS_OWNER')
  ownerId!: string | null;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'ownerId' })
  owner?: User | null;

  @Column({ type: 'jsonb', default: () => "'{}'::jsonb" })
  metadata!: Record<string, unknown>;

  @Column({ nullable: true })
  imageUrl!: string | null;

  @Column({ nullable: true })
  name!: string | null;

  @Column({ nullable: true })
  collection!: string | null;

  @Column({ default: WalletNetwork.STELLAR_MAINNET })
  @Index('IDX_NFTS_NETWORK')
  network!: WalletNetwork;

  @Column({ type: 'timestamp', nullable: true })
  lastSyncedAt!: Date | null;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
