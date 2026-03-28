import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';

@Entity('discovery_user_blocks')
@Unique('uq_discovery_user_blocks_pair', ['blockerId', 'blockedId'])
export class DiscoveryUserBlock {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  @Index('idx_discovery_user_blocks_blocker_id')
  blockerId!: string;

  @Column({ type: 'uuid' })
  @Index('idx_discovery_user_blocks_blocked_id')
  blockedId!: string;

  @CreateDateColumn({ type: 'timestamp' })
  createdAt!: Date;
}
