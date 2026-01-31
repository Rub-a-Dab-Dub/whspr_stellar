import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

@Entity('user_stats_weekly')
@Index(['userId', 'weekStart'], { unique: true })
export class UserStatsWeekly {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId!: string;

  @Column({ name: 'week_start', type: 'date' })
  weekStart!: Date;

  @Column({ name: 'week_end', type: 'date' })
  weekEnd!: Date;

  @Column({ name: 'messages_sent', type: 'int', default: 0 })
  messagesSent!: number;

  @Column({ name: 'rooms_created', type: 'int', default: 0 })
  roomsCreated!: number;

  @Column({ name: 'rooms_joined', type: 'int', default: 0 })
  roomsJoined!: number;

  @Column({ name: 'tips_sent', type: 'int', default: 0 })
  tipsSent!: number;

  @Column({ name: 'tips_received', type: 'int', default: 0 })
  tipsReceived!: number;

  @Column({
    name: 'tokens_transferred',
    type: 'decimal',
    precision: 30,
    scale: 8,
    default: 0,
  })
  tokensTransferred!: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;
}
