import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { User } from '../../user/entities/user.entity';

export enum LimitPeriod {
  DAILY = 'daily',
  WEEKLY = 'weekly',
  MONTHLY = 'monthly',
}

@Entity('transfer_limits')
@Index(['userId', 'period'])
export class TransferLimit {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ name: 'user_id' })
  userId: string;

  @Column({
    type: 'enum',
    enum: LimitPeriod,
  })
  period: LimitPeriod;

  @Column('decimal', { precision: 18, scale: 8, name: 'limit_amount' })
  limitAmount: string;

  @Column('decimal', { precision: 18, scale: 8, name: 'used_amount', default: '0' })
  usedAmount: string;

  @Column({ name: 'transaction_count', default: 0 })
  transactionCount: number;

  @Column({ name: 'max_transaction_count', nullable: true })
  maxTransactionCount: number;

  @Column({ name: 'period_start', type: 'timestamp' })
  periodStart: Date;

  @Column({ name: 'period_end', type: 'timestamp' })
  periodEnd: Date;

  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
