import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
  Index,
} from 'typeorm';
import { Room } from './room.entity';

@Entity('room_analytics')
@Index(['room', 'date'], { unique: true })
export class RoomAnalytics {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ManyToOne(() => Room, { onDelete: 'CASCADE' })
  room!: Room;

  @Column({ type: 'date' })
  date!: Date;

  @Column({ default: 0 })
  totalMessages!: number;

  @Column({ type: 'int', default: 0 })
  uniqueActiveMembers!: number;

  @Column({ type: 'jsonb', default: {} })
  hourlyActivity!: Record<string, number>; // { "0": 5, "1": 10, ... "23": 8 }

  @Column({ type: 'jsonb', default: [] })
  topContributors!: Array<{ userId: string; messageCount: number }>; // Top 10

  @Column({ type: 'int', default: 0 })
  newMembers!: number;

  @Column({ type: 'int', default: 0 })
  activeReturnMembers!: number; // Members who were active yesterday and today

  @CreateDateColumn()
  createdAt!: Date;
}
