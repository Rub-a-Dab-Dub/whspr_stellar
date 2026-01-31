import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

@Entity('user_stats_daily')
@Index(['userId', 'date'], { unique: true })
export class UserStatsDaily {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId!: string;

  @Column({ type: 'date' })
  date!: Date;

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

  @Column({ name: 'is_active', type: 'boolean', default: false })
  isActive!: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;
}
