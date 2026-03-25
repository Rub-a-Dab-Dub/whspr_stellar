import { User } from '../../user/entities/user.entity';
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

  @Column({ default: 'stellar' })
  @Index('IDX_NFTS_NETWORK')
  network!: string;

  @Column({ type: 'timestamp', nullable: true })
  lastSyncedAt!: Date | null;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
