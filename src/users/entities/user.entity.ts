import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

export enum UserTier {
  SILVER = 'silver',
  GOLD = 'gold',
  BLACK = 'black',
}

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 50, unique: true, nullable: true })
  @Index('idx_users_username')
  username!: string | null;

  @Column({ type: 'varchar', length: 42, unique: true, nullable: true })
  @Index('idx_users_wallet_address')
  walletAddress!: string | null;

  @Column({ type: 'varchar', length: 255, unique: true, nullable: true })
  @Index('idx_users_email')
  email!: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  displayName!: string | null;

  @Column({ type: 'text', nullable: true })
  avatarUrl!: string | null;

  @Column({ type: 'text', nullable: true })
  bio!: string | null;

  @Column({ type: 'varchar', length: 10, nullable: true })
  preferredLocale!: string | null;
  @Column({ type: 'varchar', length: 50, unique: true, nullable: true })
  @Index('idx_users_referral_code')
  referralCode!: string | null;

  @Column({
    type: 'enum',
    enum: UserTier,
    default: UserTier.SILVER,
  })
  tier!: UserTier;

  @Column({ type: 'boolean', default: true })
  @Index('idx_users_is_active')
  isActive!: boolean;

  @Column({ type: 'boolean', default: false })
  isVerified!: boolean;

  @CreateDateColumn({ type: 'timestamp' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamp' })
  updatedAt!: Date;
}
