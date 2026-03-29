import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  Index,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('trust_scores')
export class TrustScore {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  @Index('idx_trust_scores_user_id', { unique: true })
  userId!: string;

  @Column({ type: 'decimal', precision: 5, scale: 2, default: 0 })
  score!: number;

  @Column({ type: 'int', default: 0 })
  vouchCount!: number;

  @Column({ type: 'int', default: 0 })
  revokedCount!: number;

  @Column({ type: 'int', default: 0 })
  networkDepth!: number;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  calculatedAt!: Date;
}
