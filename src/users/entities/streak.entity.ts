import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { User } from './user.entity';

@Entity('streaks')
@Index(['userId'])
export class Streak {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'user_id', unique: true })
  userId!: string;

  @OneToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user!: User;

  @Column({ name: 'current_streak', type: 'int', default: 0 })
  currentStreak!: number;

  @Column({ name: 'longest_streak', type: 'int', default: 0 })
  longestStreak!: number;

  @Column({ name: 'last_login_date', type: 'date', nullable: true })
  lastLoginDate!: Date | null;

  @Column({ name: 'freeze_items', type: 'int', default: 0 })
  freezeItems!: number;

  @Column({ name: 'grace_period_end', type: 'timestamp', nullable: true })
  gracePeriodEnd!: Date | null;

  @Column({
    name: 'streak_multiplier',
    type: 'decimal',
    precision: 3,
    scale: 2,
    default: 1.0,
  })
  streakMultiplier!: number;

  @Column({ name: 'total_days_logged', type: 'int', default: 0 })
  totalDaysLogged!: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
