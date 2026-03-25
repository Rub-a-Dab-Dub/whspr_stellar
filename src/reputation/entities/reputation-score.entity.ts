import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  Index,
  UpdateDateColumn,
  CreateDateColumn,
} from 'typeorm';

@Entity('reputation_scores')
export class ReputationScore {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  @Index('idx_reputation_scores_user_id', { unique: true })
  userId!: string;

  @Column({ type: 'decimal', precision: 5, scale: 2, default: 0 })
  score!: number;

  @Column({ type: 'int', default: 0 })
  totalRatings!: number;

  @Column({ type: 'int', default: 0 })
  positiveRatings!: number;

  @Column({ type: 'int', default: 0 })
  flags!: number;

  @Column({ type: 'boolean', default: false })
  isUnderReview!: boolean;

  @Column({ type: 'decimal', precision: 5, scale: 2, nullable: true })
  onChainScore!: number | null;

  @Column({ type: 'timestamp', nullable: true })
  lastChainSyncAt!: Date | null;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  lastUpdatedAt!: Date;
}
