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

export enum StreakRewardType {
  XP = 'xp',
  TOKEN = 'token',
  BADGE = 'badge',
  PREMIUM = 'premium',
}

@Entity('streak_rewards')
@Index(['userId', 'claimedAt'])
@Index(['userId', 'milestone'])
export class StreakReward {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'user_id' })
  userId!: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user!: User;

  @Column({ type: 'int' })
  milestone!: number; // 3, 7, 14, 30 days

  @Column({
    type: 'enum',
    enum: StreakRewardType,
  })
  rewardType!: StreakRewardType;

  @Column({ type: 'int', nullable: true })
  rewardAmount!: number | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  rewardDescription!: string | null;

  @Column({ name: 'claimed_at', type: 'timestamp', nullable: true })
  claimedAt!: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;
}
