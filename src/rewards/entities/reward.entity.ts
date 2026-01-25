import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
  Index,
} from 'typeorm';
import { RewardType } from '../enums/reward-type.enum';
import { UserReward } from './user-reward.entity';

@Entity('rewards')
export class Reward {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({
    type: 'enum',
    enum: RewardType,
  })
  @Index()
  type!: RewardType;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  value!: number;

  @Column({ type: 'text', nullable: true })
  description!: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  name!: string;

  @Column({ type: 'varchar', length: 500, nullable: true })
  imageUrl!: string;

  @Column({ type: 'int', default: 0 })
  stackLimit!: number; // Maximum number of times this reward can stack

  @Column({ type: 'int', nullable: true })
  expirationDays!: number; // Days until expiration after granting

  @Column({ type: 'boolean', default: true })
  isActive!: boolean;

  @Column({ type: 'boolean', default: false })
  isTradeable!: boolean;

  @Column({ type: 'boolean', default: false })
  isGiftable!: boolean;

  @Column({ type: 'boolean', default: false })
  isMarketplaceItem!: boolean; // Can be listed in marketplace

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  marketplacePrice!: number; // Price if sold in marketplace

  @Column({ type: 'jsonb', nullable: true })
  metadata!: Record<string, any>; // Additional reward-specific data

  @OneToMany(() => UserReward, (userReward) => userReward.reward)
  userRewards!: UserReward[];

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
