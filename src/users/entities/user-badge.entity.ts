import {
  Entity,
  PrimaryGeneratedColumn,
  ManyToOne,
  Column,
  CreateDateColumn,
  Unique,
} from 'typeorm';
import { User } from './user.entity';
import { Badge } from './badge.entity';

export enum BadgeSource {
  QUEST = 'quest',
  MANUAL = 'manual',
  MILESTONE = 'milestone',
}

@Entity('user_badges')
@Unique(['user', 'badge'])
export class UserBadge {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => User, { eager: true })
  user: User;

  // ✅ Correct relation
  @ManyToOne(() => Badge, { eager: true })
  badge: Badge;

  @Column({
    type: 'enum',
    enum: BadgeSource,
  })
  source: BadgeSource;

  @Column({ nullable: true })
  awardedBy: string;

  @Column({ nullable: true })
  reason: string;

  @CreateDateColumn()
  awardedAt: Date;
}
