import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';

export enum ReferralStatus {
  PENDING = 'PENDING',
  COMPLETED = 'COMPLETED',
}

@Entity('referrals')
@Index('idx_referrals_referrer_status', ['referrerId', 'status'])
export class Referral {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  @Index('idx_referrals_referrer')
  referrerId!: string;

  @Column({ type: 'uuid', unique: true }) // A referee can only be referred once
  @Index('idx_referrals_referee')
  refereeId!: string;

  @Column({ type: 'varchar', length: 50 })
  @Index('idx_referrals_code')
  referralCode!: string;

  @Column({
    type: 'enum',
    enum: ReferralStatus,
    default: ReferralStatus.PENDING,
  })
  status!: ReferralStatus;

  @Column({ type: 'decimal', precision: 20, scale: 8, default: 0 })
  rewardAmount!: number;

  @Column({ type: 'timestamp', nullable: true })
  completedAt!: Date | null;

  @CreateDateColumn({ type: 'timestamp' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamp' })
  updatedAt!: Date;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'referrerId' })
  referrer!: User;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'refereeId' })
  referee!: User;
}
