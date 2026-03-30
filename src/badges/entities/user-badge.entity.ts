import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Badge } from './badge.entity';

@Entity('user_badges')
@Index('idx_user_badges_user_badge', ['userId', 'badgeId'], { unique: true })
@Index('idx_user_badges_user_id', ['userId'])
export class UserBadge {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  userId!: string;

  @Column({ type: 'uuid' })
  badgeId!: string;

  @ManyToOne(() => Badge, { eager: true })
  @JoinColumn({ name: 'badgeId' })
  badge!: Badge;

  /** Whether this badge is shown on the user's public profile (max 3). */
  @Column({ type: 'boolean', default: false })
  isDisplayed!: boolean;

  @CreateDateColumn({ type: 'timestamp' })
  awardedAt!: Date;
}
