import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { GroupEvent } from './group-event.entity';

export enum RSVPStatus {
  GOING = 'GOING',
  MAYBE = 'MAYBE',
  NOT_GOING = 'NOT_GOING',
  WAITLISTED = 'WAITLISTED',
}

@Entity('event_rsvps')
@Index('idx_event_rsvps_event_id', ['eventId'])
@Index('idx_event_rsvps_user_id', ['userId'])
@Index('idx_event_rsvps_event_status', ['eventId', 'status'])
export class EventRSVP {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  eventId!: string;

  @Column({ type: 'uuid' })
  userId!: string;

  @Column({ type: 'enum', enum: RSVPStatus })
  status!: RSVPStatus;

  @ManyToOne(() => GroupEvent, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'eventId' })
  event!: GroupEvent;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user!: User;

  @UpdateDateColumn({ type: 'timestamp' })
  respondedAt!: Date;
}
