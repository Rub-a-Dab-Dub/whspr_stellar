import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

export enum RoomType {
  PUBLIC = 'PUBLIC',
  PRIVATE = 'PRIVATE',
  TOKEN_GATED = 'TOKEN_GATED',
  TIMED = 'TIMED',
}

@Entity('rooms')
export class Room {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 100 })
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({
    type: 'enum',
    enum: RoomType,
    default: RoomType.PUBLIC,
  })
  type: RoomType;

  @ManyToOne('User', { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'creator_id' })
  creator: unknown;

  @Column({ name: 'creator_id' })
  creatorId: string;

  @Column({ name: 'creator_wallet_address', length: 56, nullable: true })
  creatorWalletAddress: string;

  @Column('decimal', { precision: 18, scale: 8, nullable: true })
  entryFee: string;

  @Column({ name: 'token_address', length: 56, nullable: true })
  tokenAddress: string;

  @Column({ name: 'max_members', default: 100 })
  maxMembers: number;

  @Column({ name: 'expires_at', nullable: true })
  expiresAt: Date;

  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  /**
   * Topic tags for discovery (max 5 items).
   * Stored as a comma-separated text column via TypeORM's simple-array strategy.
   */
  @Column({ type: 'simple-array', nullable: true, default: null })
  tags: string[];

  /**
   * Blockchain network identifier (e.g. "stellar", "ethereum").
   * Used for chain-based filtering in the discovery API.
   */
  @Column({ length: 64, nullable: true, default: null })
  chain: string;

  /**
   * Trending score = messageCount24h × memberCount.
   * Recalculated every 15 minutes by the cron job.
   */
  @Column({
    name: 'trending_score',
    type: 'numeric',
    precision: 20,
    scale: 4,
    default: 0,
  })
  trendingScore: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
