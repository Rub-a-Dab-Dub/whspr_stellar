import { User } from '../../user/entities/user.entity';
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  OneToMany,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { RoomPayment } from './room-payment.entity';

@Entity('rooms')
export class Room {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column()
  name!: string;

  @Column({ type: 'text', nullable: true })
  description!: string;

  @ManyToOne(() => User)
  owner!: User;

  @ManyToOne(() => User, { nullable: true })
  creator?: User;

  @Column({ default: false })
  isPrivate!: boolean;

  @Column({ type: 'varchar', nullable: true })
  icon!: string;

  @Column({ default: 0 })
  memberCount!: number;

  @Column({ name: 'is_token_gated', default: false })
  isTokenGated: boolean;

  @Column('decimal', { precision: 18, scale: 8, name: 'entry_fee', default: 0 })
  entryFee: string;

  @Column({ name: 'token_address', nullable: true })
  tokenAddress: string;

  @Column({ name: 'payment_required', default: false })
  paymentRequired: boolean;

  @Column({ name: 'free_trial_enabled', default: false })
  freeTrialEnabled: boolean;

  @Column({ name: 'free_trial_duration_hours', default: 24 })
  freeTrialDurationHours: number;

  @Column({ name: 'access_duration_days', nullable: true })
  accessDurationDays: number;

  @OneToMany(() => RoomPayment, payment => payment.room)
  payments: RoomPayment[];

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
