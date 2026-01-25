import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  Index,
} from 'typeorm';
import { UserReward } from './user-reward.entity';
import { User } from '../../users/entities/user.entity';

export enum MarketplaceListingStatus {
  ACTIVE = 'active',
  SOLD = 'sold',
  CANCELLED = 'cancelled',
}

@Entity('reward_marketplace')
@Index(['sellerId', 'status'])
@Index(['status', 'price'])
export class RewardMarketplace {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column()
  sellerId!: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  seller!: User;

  @Column()
  userRewardId!: string;

  @ManyToOne(() => UserReward, { onDelete: 'CASCADE' })
  userReward!: UserReward;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  price!: number;

  @Column({
    type: 'enum',
    enum: MarketplaceListingStatus,
    default: MarketplaceListingStatus.ACTIVE,
  })
  @Index()
  status!: MarketplaceListingStatus;

  @Column({ type: 'uuid', nullable: true })
  buyerId!: string;

  @Column({ type: 'timestamp', nullable: true })
  soldAt!: Date;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
