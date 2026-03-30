import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Treasury } from './treasury.entity';
import { TreasuryVote } from './treasury-vote.entity';

export enum ProposalStatus {
  ACTIVE = 'ACTIVE',
  PASSED = 'PASSED',
  REJECTED = 'REJECTED',
  EXECUTED = 'EXECUTED',
  EXPIRED = 'EXPIRED',
}

@Entity('dao_treasury_proposals')
@Index('idx_dao_proposal_treasury_id', ['treasuryId'])
@Index('idx_dao_proposal_status', ['status'])
@Index('idx_dao_proposal_expires_at', ['expiresAt'])
export class TreasuryProposal {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  treasuryId!: string;

  @Column({ type: 'uuid' })
  proposerId!: string;

  @Column({ type: 'varchar', length: 64 })
  recipientAddress!: string;

  @Column({ type: 'numeric', precision: 38, scale: 0 })
  amount!: string;

  @Column({ type: 'text' })
  description!: string;

  @Column({ type: 'enum', enum: ProposalStatus, default: ProposalStatus.ACTIVE })
  status!: ProposalStatus;

  @Column({ type: 'int', default: 2 })
  quorumRequired!: number;

  @Column({ type: 'int', default: 0 })
  votesFor!: number;

  @Column({ type: 'int', default: 0 })
  votesAgainst!: number;

  @Column({ type: 'varchar', length: 128, nullable: true })
  sorobanTxHash!: string | null;

  @Column({ type: 'timestamp' })
  expiresAt!: Date;

  @CreateDateColumn({ type: 'timestamp' })
  createdAt!: Date;

  @ManyToOne(() => Treasury, (t) => t.proposals, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'treasuryId' })
  treasury!: Treasury;

  @OneToMany(() => TreasuryVote, (v) => v.proposal)
  votes!: TreasuryVote[];
}
