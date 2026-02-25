import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index } from 'typeorm';

export enum EventType {
  USER_LOGIN = 'USER_LOGIN',
  MESSAGE_SENT = 'MESSAGE_SENT',
  TIP_SENT = 'TIP_SENT',
  ROOM_JOINED = 'ROOM_JOINED',
  ROOM_CREATED = 'ROOM_CREATED',
  QUEST_COMPLETED = 'QUEST_COMPLETED',
}

@Entity('analytics_events')
@Index(['userId', 'createdAt'])
@Index(['eventType', 'createdAt'])
export class AnalyticsEvent {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid')
  @Index()
  userId: string;

  @Column({ type: 'enum', enum: EventType })
  @Index()
  eventType: EventType;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, any>;

  @Column({ nullable: true })
  ipAddress: string;

  @Column({ nullable: true })
  userAgent: string;

  @CreateDateColumn()
  @Index()
  createdAt: Date;
}
