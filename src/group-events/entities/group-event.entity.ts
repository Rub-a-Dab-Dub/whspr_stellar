import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  ManyToOne,
  JoinColumn,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';

export enum EventType {
  VIRTUAL = 'VIRTUAL',
  PHYSICAL = 'PHYSICAL',
}

export enum EventStatus {
  ACTIVE = 'ACTIVE',
  CANCELLED = 'CANCELLED',
}

@Entity('group_events')
@Index('idx_group_events_group_id', ['groupId'])
@Index('idx_group_events_start_time', ['startTime'])
@Index('idx_group_events_status', ['status'])
export class GroupEvent {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  groupId!: string;

  @Column({ type: 'uuid' })
  createdBy!: string;

  @Column({ type: 'varchar', length: 200 })
  title!: string;

  @Column({ type: 'text', nullable: true })
  description!: string | null;

  @Column({ type: 'enum', enum: EventType })
  eventType!: EventType;

  @Column({ type: 'varchar', length: 500, nullable: true })
  location!: string | null;

  @Column({ type: 'text', nullable: true })
  meetingUrl!: string | null;

  @Column({ type: 'timestamp' })
  startTime!: Date;

  @Column({ type: 'timestamp' })
  endTime!: Date;

  @Column({ type: 'int', nullable: true })
  maxAttendees!: number | null;

  @Column({ type: 'boolean', default: true })
  isPublic!: boolean;

  @Column({ type: 'enum', enum: EventStatus, default: EventStatus.ACTIVE })
  status!: EventStatus;

  @Column({ type: 'boolean', default: false })
  reminderSent!: boolean;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'createdBy' })
  creator!: User;

  @CreateDateColumn({ type: 'timestamp' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamp' })
  updatedAt!: Date;
}
