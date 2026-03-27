import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, Index, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { User } from '../../users/entities/user.entity';

export enum LeaderboardType {
  TRANSFER_VOLUME = 'transfer_volume',
  REFERRALS = 'referrals',
  REPUTATION = 'reputation',
  MESSAGES_SENT = 'messages_sent',
  GROUP_ACTIVITY = 'group_activity',
}

export enum LeaderboardPeriod {
  WEEKLY = 'weekly',
  MONTHLY = 'monthly',
  ALL_TIME = 'all_time',
}

@Entity('leaderboard_entries')
@Index(['boardType', 'period'], { unique: true, where: '"rank" IS NOT NULL' })
@Index(['boardType', 'period', 'rank'])
@Index(['userId', 'boardType', 'period'], { unique: true })
export class LeaderboardEntry {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({
    type: 'enum',
    enum: LeaderboardType,
  })
  boardType: LeaderboardType;

  @Column('uuid')
  userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE', eager: false })
  user: User;

  @Column('numeric', { precision: 18, scale: 2, default: 0 })
  score: number; // Transfer volume, referral count, reputation points, etc

  @Column('integer', { nullable: true })
  rank: number; // 1-based ranking (null = not in top 100+)

  @Column({
    type: 'enum',
    enum: LeaderboardPeriod,
    default: LeaderboardPeriod.ALL_TIME,
  })
  period: LeaderboardPeriod;

  @Column('timestamp')
  periodStartAt: Date; // When this period started

  @Column('timestamp')
  periodEndAt: Date; // When this period ends (null for ALL_TIME)

  @Column('timestamp')
  computedAt: Date; // When rank was calculated

  @Column('integer', { default: 0 })
  changeFromLastPeriod: number; // Rank change (positive = improved)

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

@Entity('leaderboard_snapshots')
@Index(['boardType', 'period', 'snapshotDate'])
@Index(['userId', 'boardType', 'period'])
export class LeaderboardSnapshot {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({
    type: 'enum',
    enum: LeaderboardType,
  })
  boardType: LeaderboardType;

  @Column('uuid')
  userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE', eager: false })
  user: User;

  @Column('numeric', { precision: 18, scale: 2 })
  score: number;

  @Column('integer')
  rank: number; // Position at snapshot time

  @Column({
    type: 'enum',
    enum: LeaderboardPeriod,
  })
  period: LeaderboardPeriod;

  @Column('timestamp')
  snapshotDate: Date; // When period ended

  @Column('integer', { nullable: true })
  rankChangeFromPrevious: number; // How rank changed

  @CreateDateColumn()
  recordedAt: Date;
}
