import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
} from 'typeorm';
import { StakeholderDistribution } from '../revenue.types';

@Entity('fee_distributions')
export class FeeDistribution {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'date' })
  period!: string;

  @Column({ type: 'numeric', precision: 38, scale: 7 })
  totalCollected!: string;

  @Column({ type: 'numeric', precision: 38, scale: 7 })
  platformShare!: string;

  @Column('jsonb')
  stakeholderDistributions!: StakeholderDistribution[];

  @Column({ type: 'timestamp', nullable: true })
  distributedAt?: Date;

  @Column({ type: 'varchar', length: 64, nullable: true })
  txHash?: string;

  @CreateDateColumn({ type: 'timestamp' })
  createdAt!: Date;
}

