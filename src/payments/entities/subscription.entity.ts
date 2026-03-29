import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  ManyToOne,
  JoinColumn,
  OneToMany,
} from 'typeorm';
import { UserTier } from '../../users/entities/user.entity';
import { User } from '../../users/entities/user.entity';
import { PaymentRecord } from './payment-record.entity';

export enum SubscriptionStatus {
  ACTIVE = 'ACTIVE',
  CANCELLED = 'CANCELLED',
  EXPIRED = 'EXPIRED',
  PAST_DUE = 'PAST_DUE',
}

@Entity('subscriptions')
@Index('idx_subscriptions_user_id', ['userId'])
@Index('idx_subscriptions_status', ['status'])
@Index('idx_subscriptions_provider_sub_id', ['providerSubscriptionId'], { unique: true })
export class Subscription {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column('uuid')
  userId!: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user!: User;

  @Column({
    type: 'enum',
    enum: UserTier,
    default: UserTier.SILVER,
  })
  tier!: UserTier;

  @Column({
    type: 'enum',
    enum: SubscriptionStatus,
    default: SubscriptionStatus.ACTIVE,
  })
  status!: SubscriptionStatus;

  @Column({ type: 'varchar', length: 255, nullable: true })
  providerSubscriptionId!: string | null;

  @Column({ type: 'timestamp', nullable: true })
  currentPeriodStart!: Date | null;

  @Column({ type: 'timestamp', nullable: true })
  currentPeriodEnd!: Date | null;

  @Column({ type: 'timestamp', nullable: true })
  cancelledAt!: Date | null;

  @OneToMany(() => PaymentRecord, payment => payment.subscription)
  payments!: PaymentRecord[];

  @CreateDateColumn({ type: 'timestamp' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamp' })
  updatedAt!: Date;
}

