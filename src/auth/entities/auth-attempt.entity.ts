import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

@Entity('auth_attempts')
export class AuthAttempt {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 56 })
  @Index('idx_auth_attempts_wallet_address')
  walletAddress!: string;

  @Column({ type: 'varchar', length: 45 })
  @Index('idx_auth_attempts_ip_address')
  ipAddress!: string;

  @Column({ type: 'boolean' })
  success!: boolean;

  @CreateDateColumn({ type: 'timestamp' })
  @Index('idx_auth_attempts_created_at')
  createdAt!: Date;
}
