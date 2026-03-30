import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { TreasuryProposal } from './treasury-proposal.entity';

export enum VoteChoice {
  FOR = 'FOR',
  AGAINST = 'AGAINST',
}

@Entity('dao_treasury_votes')
@Index('idx_dao_vote_proposal_voter', ['proposalId', 'voterId'], { unique: true })
@Index('idx_dao_vote_proposal_id', ['proposalId'])
export class TreasuryVote {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  proposalId!: string;

  @Column({ type: 'uuid' })
  voterId!: string;

  @Column({ type: 'enum', enum: VoteChoice })
  vote!: VoteChoice;

  @CreateDateColumn({ type: 'timestamp' })
  castedAt!: Date;

  @ManyToOne(() => TreasuryProposal, (p) => p.votes, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'proposalId' })
  proposal!: TreasuryProposal;
}
