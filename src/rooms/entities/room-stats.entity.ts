import { Entity, PrimaryGeneratedColumn, Column, Index, CreateDateColumn } from 'typeorm';

@Entity('room_stats')
@Index(['roomId', 'periodStart'])
export class RoomStats {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid')
  @Index()
  roomId: string;

  @Column({ type: 'int', default: 0 })
  messageCount: number;

  @Column({ type: 'int', default: 0 })
  uniqueSenders: number;

  @Column({ type: 'decimal', precision: 20, scale: 7, default: 0 })
  tipVolume: string;

  @Column({ type: 'int', default: 0 })
  peakConcurrent: number;

  @Column({ type: 'timestamp' })
  @Index()
  periodStart: Date;

  @CreateDateColumn()
  createdAt: Date;
}
