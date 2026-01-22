// src/sessions/entities/session.entity.ts
import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { User } from '../../user/entities/user.entity';

@Entity('sessions')
@Index(['userId', 'isActive'])
@Index(['token'])
export class Session {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  token: string;

  @Column({ name: 'user_id' })
  userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ name: 'refresh_token', nullable: true })
  refreshToken: string;

  @Column({ name: 'ip_address', nullable: true })
  ipAddress: string;

  @Column({ name: 'user_agent', type: 'text', nullable: true })
  userAgent: string;

  @Column({ name: 'device_type', nullable: true })
  deviceType: string;

  @Column({ name: 'device_name', nullable: true })
  deviceName: string;

  @Column({ name: 'browser', nullable: true })
  browser: string;

  @Column({ name: 'os', nullable: true })
  os: string;

  @Column({ name: 'device_fingerprint', nullable: true })
  deviceFingerprint: string;

  @Column({ type: 'jsonb', nullable: true })
  location: {
    country?: string;
    city?: string;
    region?: string;
    timezone?: string;
  };

  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  @Column({
    name: 'last_activity',
    type: 'timestamp',
    default: () => 'CURRENT_TIMESTAMP',
  })
  lastActivity: Date;

  @Column({ name: 'expires_at', type: 'timestamp' })
  expiresAt: Date;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
