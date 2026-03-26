import { Entity, PrimaryColumn, Column, UpdateDateColumn } from 'typeorm';
import type { AppConfigValueType } from '../constants';

@Entity('app_config')
export class AppConfig {
  @PrimaryColumn({ type: 'varchar', length: 128 })
  key!: string;

  @Column({ type: 'jsonb' })
  value!: unknown;

  @Column({ type: 'varchar', length: 16 })
  valueType!: AppConfigValueType;

  @Column({ type: 'text', nullable: true })
  description!: string | null;

  @Column({ type: 'boolean', default: false })
  isPublic!: boolean;

  @Column({ type: 'uuid', nullable: true })
  updatedBy!: string | null;

  @UpdateDateColumn({ type: 'timestamp with time zone' })
  updatedAt!: Date;
}
