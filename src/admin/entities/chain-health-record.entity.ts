import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';
import { ChainHealthStatus } from '../enums/chain-health-status.enum';

@Entity('chain_health_records')
@Index(['chain', 'checkedAt'])
@Index(['checkedAt'])
export class ChainHealthRecord {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 20 })
  chain: string;

  @Column({ type: 'enum', enum: ChainHealthStatus })
  status: ChainHealthStatus;

  @Column({ type: 'int', nullable: true })
  latencyMs: number | null;

  @Column({ type: 'bigint', nullable: true })
  blockNumber: number | null;

  @Column({ type: 'int', nullable: true })
  blockAge: number | null;

  @Column({ type: 'varchar', length: 40, nullable: true })
  paymasterBalance: string | null;

  @Column({ type: 'boolean', default: false })
  paymasterBalanceWarning: boolean;

  @CreateDateColumn({ name: 'checkedAt' })
  checkedAt: Date;
}
