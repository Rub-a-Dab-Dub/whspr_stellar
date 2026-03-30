import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';
import { RevenueSourceType } from '../revenue.types';

@Entity('revenue_records')
@Index('idx_revenue_period_source', ['period', 'sourceType'])
@Index('idx_revenue_source_token', ['sourceType', 'tokenId'])
@Index('idx_revenue_source_id', ['sourceType', 'sourceId'])
export class RevenueRecord {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({
    type: 'enum',
    enum: RevenueSourceType,
  })
  sourceType!: RevenueSourceType;

  @Column({ type: 'uuid' })
  sourceId!: string; // txId, subscriptionId, etc.

  @Column({ type: 'numeric', precision: 38, scale: 7 })
  amount!: string;

  @Column({ type: 'varchar', length: 44 })
  tokenId!: string;

  @Column({ type: 'numeric', precision: 20, scale: 2 })
  usdValue!: number;

  @Column({ type: 'date' })
  period!: string; // YYYY-MM-DD

  @CreateDateColumn({ type: 'timestamp' })
  createdAt!: Date;
}

