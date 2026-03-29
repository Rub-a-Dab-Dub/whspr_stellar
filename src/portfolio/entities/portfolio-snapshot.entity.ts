import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

export interface PortfolioBalance {
  symbol: string;
  contractId?: string;
  amount: string;
  usdValue: number;
}

@Entity('portfolio_snapshots')
@Index('idx_portfolio_user_date', ['userId', 'snapshotDate'])
export class PortfolioSnapshot {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column()
  userId!: string;

  @Column('numeric', { precision: 20, scale: 2 })
  totalUsdValue!: number;

  @Column('jsonb')
  balances!: PortfolioBalance[];

  @Column()
  snapshotDate!: Date;

  @CreateDateColumn()
  createdAt!: Date;
}

