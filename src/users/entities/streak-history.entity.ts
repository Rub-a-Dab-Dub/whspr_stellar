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

export enum StreakAction {
  LOGIN = 'login',
  INCREMENT = 'increment',
  RESET = 'reset',
  FREEZE_USED = 'freeze_used',
  GRACE_PERIOD_USED = 'grace_period_used',
  REWARD_CLAIMED = 'reward_claimed',
}

@Entity('streak_history')
@Index(['userId', 'createdAt'])
export class StreakHistory {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'user_id' })
  userId!: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user!: User;

  @Column({
    type: 'enum',
    enum: StreakAction,
  })
  action!: StreakAction;

  @Column({ type: 'int', nullable: true })
  streakBefore!: number | null;

  @Column({ type: 'int', nullable: true })
  streakAfter!: number | null;

  @Column({ type: 'text', nullable: true })
  description!: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;
}
