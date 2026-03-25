import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

@Entity('analytics_events')
@Index('idx_analytics_events_metric_key_created_at', ['metricKey', 'createdAt'])
@Index('idx_analytics_events_user_id_created_at', ['userId', 'createdAt'])
export class AnalyticsEvent {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 64 })
  eventType!: string;

  @Column({ type: 'varchar', length: 64 })
  metricKey!: string;

  @Column({ type: 'uuid', nullable: true })
  userId!: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true, unique: true })
  idempotencyKey!: string | null;

  @Column({ type: 'jsonb', default: () => "'{}'" })
  metadata!: Record<string, unknown>;

  @CreateDateColumn({ type: 'timestamp' })
  createdAt!: Date;
}
