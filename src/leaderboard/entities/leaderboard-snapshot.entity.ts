import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';
import {
  LeaderboardCategory,
  LeaderboardPeriod,
} from '../leaderboard.interface';

@Entity('leaderboard_snapshots')
@Index(['category', 'period', 'createdAt'])
export class LeaderboardSnapshot {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({
    type: 'enum',
    enum: LeaderboardCategory,
  })
  category: LeaderboardCategory;

  @Column({
    type: 'enum',
    enum: LeaderboardPeriod,
  })
  period: LeaderboardPeriod;

  @Column({ nullable: true })
  roomId: string;

  @Column({ type: 'text', nullable: true })
  reason: string;

  @Column({ type: 'uuid', nullable: true })
  resetBy: string;

  @Column({ type: 'jsonb' })
  data: any[]; // Top entries at the time of snapshot

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, any>;

  @CreateDateColumn()
  createdAt: Date;
}
