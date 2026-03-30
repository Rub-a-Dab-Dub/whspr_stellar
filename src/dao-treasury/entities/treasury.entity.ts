import {
  Column,
  Entity,
  Index,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { TreasuryProposal } from './treasury-proposal.entity';

@Entity('dao_treasuries')
@Index('idx_dao_treasury_group_id', ['groupId'], { unique: true })
export class Treasury {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  groupId!: string;

  @Column({ type: 'numeric', precision: 38, scale: 0, default: '0' })
  balance!: string;

  @Column({ type: 'varchar', length: 64 })
  tokenAddress!: string;

  @UpdateDateColumn({ type: 'timestamp' })
  lastSyncedAt!: Date;

  @OneToMany(() => TreasuryProposal, (p) => p.treasury)
  proposals!: TreasuryProposal[];
}
