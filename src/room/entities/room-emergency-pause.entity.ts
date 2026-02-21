import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  JoinColumn,
} from 'typeorm';
import { Room } from './room.entity';
import { User } from '../../user/entities/user.entity';

export enum EmergencyPauseReason {
  SPAM = 'SPAM',
  ABUSE = 'ABUSE',
  SECURITY = 'SECURITY',
  MAINTENANCE = 'MAINTENANCE',
  OTHER = 'OTHER',
}

@Entity('room_emergency_pauses')
@Index(['roomId'])
@Index(['roomId', 'isPaused'])
export class RoomEmergencyPause {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid')
  roomId: string;

  @Column('uuid')
  pausedBy: string;

  @Column({
    type: 'enum',
    enum: EmergencyPauseReason,
    default: EmergencyPauseReason.OTHER,
  })
  reason: EmergencyPauseReason;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ default: true })
  isPaused: boolean;

  @Column({ type: 'timestamp', nullable: true })
  resumedAt: Date;

  @Column('uuid', { nullable: true })
  resumedBy: string;

  @CreateDateColumn()
  pausedAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @ManyToOne(() => Room, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'roomId' })
  room: Room;

  @ManyToOne(() => User, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'pausedBy' })
  pausedByUser: User;

  @ManyToOne(() => User, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'resumedBy' })
  resumedByUser: User;
}
