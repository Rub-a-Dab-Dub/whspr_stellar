import { Column, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { User } from '../../users/entities/user.entity';

@Entity('user_sessions')
export class UserSession {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  @Index('idx_user_sessions_user_id')
  userId!: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user!: User;

  @Column({ type: 'varchar', length: 255 })
  @Index('idx_user_sessions_refresh_token_hash')
  refreshTokenHash!: string;

  @Column({ type: 'varchar', length: 255 })
  deviceInfo!: string;

  @Column({ type: 'varchar', length: 45, nullable: true })
  ipAddress!: string | null;

  @Column({ type: 'text', nullable: true })
  userAgent!: string | null;

  @Column({ type: 'timestamp' })
  lastActiveAt!: Date;

  @Column({ type: 'timestamp' })
  @Index('idx_user_sessions_expires_at')
  expiresAt!: Date;

  @Column({ type: 'timestamp', nullable: true })
  revokedAt!: Date | null;
}
