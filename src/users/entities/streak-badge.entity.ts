import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { User } from './user.entity';

export enum BadgeType {
  STREAK_3 = 'streak_3',
  STREAK_7 = 'streak_7',
  STREAK_14 = 'streak_14',
  STREAK_30 = 'streak_30',
  STREAK_60 = 'streak_60',
  STREAK_100 = 'streak_100',
  STREAK_365 = 'streak_365',
  LONGEST_STREAK_10 = 'longest_streak_10',
  LONGEST_STREAK_30 = 'longest_streak_30',
  LONGEST_STREAK_100 = 'longest_streak_100',
}

@Entity('streak_badges')
@Index(['userId', 'badgeType'], { unique: true })
export class StreakBadge {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'user_id' })
  userId!: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user!: User;

  @Column({
    type: 'enum',
    enum: BadgeType,
  })
  badgeType!: BadgeType;

  @Column({ type: 'varchar', length: 200, nullable: true })
  description!: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;
}
