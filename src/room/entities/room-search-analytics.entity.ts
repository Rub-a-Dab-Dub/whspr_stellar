import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

@Entity('room_search_analytics')
@Index(['userId', 'createdAt'])
@Index(['createdAt'])
export class RoomSearchAnalytics {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'text', nullable: true })
  query: string | null;

  @Column({ type: 'uuid', nullable: true })
  userId: string | null;

  @Column({ type: 'int', default: 0 })
  resultCount: number;

  @Column('jsonb', { nullable: true })
  filters: Record<string, any> | null;

  @CreateDateColumn()
  createdAt: Date;
}
