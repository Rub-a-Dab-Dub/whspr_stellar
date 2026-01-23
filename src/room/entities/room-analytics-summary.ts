import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  OneToOne,
  JoinColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Room } from './room.entity';

@Entity('room_analytics_summary')
export class RoomAnalyticsSummary {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @OneToOne(() => Room, { onDelete: 'CASCADE' })
  @JoinColumn()
  room!: Room;

  @Column({ type: 'bigint', default: 0 })
  totalMessagesAllTime!: number;

  @Column({ type: 'int', default: 0 })
  totalMembers!: number;

  @Column({ type: 'int', default: 0 })
  activeToda!: number;

  @Column({ type: 'int', default: 0 })
  activeThisWeek!: number;

  @Column({ type: 'decimal', precision: 5, scale: 2, default: 0 })
  engagementScore!: number; // 0-100

  @Column({ type: 'decimal', precision: 5, scale: 2, default: 0 })
  growthRate!: number; // Percentage

  @Column({ type: 'int', nullable: true })
  peakHour!: number; // 0-23

  @UpdateDateColumn()
  updatedAt!: Date;
}
