import { Column, Entity, PrimaryColumn, UpdateDateColumn } from 'typeorm';
import { UserTier } from '../../users/entities/user.entity';

@Entity('feature_flags')
export class FeatureFlag {
  @PrimaryColumn({ type: 'varchar', length: 128 })
  key!: string;

  @Column({ type: 'boolean', default: false })
  isEnabled!: boolean;

  @Column({ type: 'int', default: 0 })
  rolloutPercentage!: number;

  @Column({ type: 'jsonb', default: () => "'[]'" })
  allowedUserIds!: string[];

  @Column({ type: 'jsonb', default: () => "'[]'" })
  allowedTiers!: UserTier[];

  @Column({ type: 'text', nullable: true })
  description!: string | null;

  @UpdateDateColumn({ type: 'timestamp with time zone' })
  updatedAt!: Date;
}
