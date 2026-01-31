import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

@Entity('user_stats')
@Index(['userId'], { unique: true })
export class UserStats {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId!: string;

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

  @Column({ name: 'last_active_at', type: 'timestamp', nullable: true })
  lastActiveAt!: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
