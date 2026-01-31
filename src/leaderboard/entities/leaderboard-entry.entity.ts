import { Entity, Column, PrimaryGeneratedColumn, Index, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { LeaderboardCategory, LeaderboardTimeframe } from '../leaderboard.interface';

@Entity('leaderboard_entries')
@Index(['category', 'timeframe', 'roomId', 'score']) // Composite index for efficient queries
@Index(['userId', 'category', 'timeframe', 'roomId'], { unique: true }) // Unique constraint
export class LeaderboardEntry {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  @Index()
  userId: string;

  @Column()
  username: string;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  score: number;

  @Column({ type: 'int', default: 0 })
  rank: number;

  @Column({
    type: 'enum',
    enum: LeaderboardCategory,
  })
  category: LeaderboardCategory;

  @Column({
    type: 'enum',
    enum: LeaderboardTimeframe,
    default: LeaderboardTimeframe.ALL_TIME,
  })
  timeframe: LeaderboardTimeframe;

  @Column({ nullable: true })
  @Index()
  roomId?: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @Column({ type: 'timestamp', nullable: true })
  lastResetAt?: Date;
}
