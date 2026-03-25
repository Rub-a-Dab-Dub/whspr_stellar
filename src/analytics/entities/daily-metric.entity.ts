import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

const numericTransformer = {
  to: (value?: string | number | null) => value,
  from: (value: string | null) => value,
};

@Entity('daily_metrics')
@Index('idx_daily_metrics_date_metric_key', ['date', 'metricKey'])
export class DailyMetric {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'date' })
  date!: string;

  @Column({ type: 'varchar', length: 64 })
  metricKey!: string;

  @Column({ type: 'numeric', precision: 30, scale: 8, transformer: numericTransformer })
  value!: string;

  @Column({ type: 'jsonb', default: () => "'{}'" })
  metadata!: Record<string, unknown>;

  @CreateDateColumn({ type: 'timestamp' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamp' })
  updatedAt!: Date;
}
