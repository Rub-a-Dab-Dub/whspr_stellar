import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export enum BadgeTier {
  BRONZE = 'BRONZE',
  SILVER = 'SILVER',
  GOLD = 'GOLD',
  PLATINUM = 'PLATINUM',
}

export enum BadgeKey {
  FIRST_TRANSFER = 'FIRST_TRANSFER',
  TOP_REFERRER = 'TOP_REFERRER',
  CHAT_CHAMPION = 'CHAT_CHAMPION',
  DAO_VOTER = 'DAO_VOTER',
  EARLY_ADOPTER = 'EARLY_ADOPTER',
  CRYPTO_WHALE = 'CRYPTO_WHALE',
  GROUP_FOUNDER = 'GROUP_FOUNDER',
}

export interface BadgeCriteria {
  description: string;
  /** e.g. { minTransfers: 1 } */
  [key: string]: unknown;
}

@Entity('badges')
export class Badge {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 100, unique: true })
  @Index('idx_badges_key')
  key!: BadgeKey;

  @Column({ type: 'varchar', length: 100 })
  name!: string;

  @Column({ type: 'text' })
  description!: string;

  @Column({ type: 'varchar', length: 500, nullable: true })
  iconUrl!: string | null;

  @Column({ type: 'enum', enum: BadgeTier, default: BadgeTier.BRONZE })
  tier!: BadgeTier;

  @Column({ type: 'jsonb' })
  criteria!: BadgeCriteria;

  @CreateDateColumn({ type: 'timestamp' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamp' })
  updatedAt!: Date;
}
