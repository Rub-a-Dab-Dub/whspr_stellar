import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index } from 'typeorm';

@Entity('auth_challenges')
export class AuthChallenge {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 56 })
  @Index('idx_auth_challenges_wallet_address')
  walletAddress!: string;

  @Column({ type: 'varchar', length: 64 })
  nonce!: string;

  @Column({ type: 'timestamp' })
  @Index('idx_auth_challenges_expires_at')
  expiresAt!: Date;

  @CreateDateColumn({ type: 'timestamp' })
  createdAt!: Date;
}
