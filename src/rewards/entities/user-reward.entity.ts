import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  Index,
} from 'typeorm';
import { UserRewardStatus } from '../enums/user-reward-status.enum';
import { Reward } from './reward.entity';
import { User } from '../../users/entities/user.entity';

@Entity('user_rewards')
@Index(['userId', 'status'])
@Index(['userId', 'expiresAt'])
@Index(['rewardId', 'status'])
export class UserReward {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column()
  userId!: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  user!: User;

  @Column()
  rewardId!: string;

  @ManyToOne(() => Reward, { eager: true })
  reward!: Reward;

  @Column({
    type: 'enum',
    enum: UserRewardStatus,
    default: UserRewardStatus.ACTIVE,
  })
  @Index()
  status!: UserRewardStatus;

  @Column({ type: 'timestamp', nullable: true })
  expiresAt!: Date;

  @Column({ type: 'timestamp', nullable: true })
  redeemedAt!: Date;

  @Column({ type: 'uuid', nullable: true })
  tradedToUserId!: string; // User who received this reward via trade

  @Column({ type: 'uuid', nullable: true })
  giftedToUserId!: string; // User who received this reward via gift

  @Column({ type: 'uuid', nullable: true })
  grantedByUserId!: string; // Admin/system user who granted this reward

  @Column({ type: 'varchar', length: 255, nullable: true })
  eventName!: string; // Special event name if granted for an event

  @Column({ type: 'jsonb', nullable: true })
  metadata!: Record<string, any>; // Additional data

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
