import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';

@Entity('sponsorship_quotas')
@Unique('uq_sponsorship_quota_user_period', ['userId', 'period'])
export class SponsorshipQuota {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  @Index('idx_sponsorship_quotas_user_period', ['userId', 'period'])
  userId!: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user!: User;

  /** Calendar month UTC, e.g. 2026-03 */
  @Column({ type: 'varchar', length: 7 })
  period!: string;

  @Column({ type: 'int', default: 0 })
  quotaUsed!: number;

  @Column({ type: 'int' })
  quotaLimit!: number;

  /** First instant of next calendar month (UTC) when this period ends. */
  @Column({ type: 'timestamptz' })
  resetAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;
}
