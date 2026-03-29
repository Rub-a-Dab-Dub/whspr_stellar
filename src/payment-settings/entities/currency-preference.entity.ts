import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  Unique,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';

export enum DisplayCurrency {
  NGN = 'NGN', // Nigerian Naira - highest priority
  USD = 'USD', // US Dollar
  GHS = 'GHS', // Ghanaian Cedi
  KES = 'KES', // Kenyan Shilling
  ZAR = 'ZAR', // South African Rand
  EUR = 'EUR', // Euro
  GBP = 'GBP', // British Pound
}

/**
 * CurrencyPreference - User's preferred display currency for all monetary amounts
 * Each user has exactly one preference record with their chosen fiat currency
 */
@Entity('currency_preferences')
@Unique('uq_currency_preferences_user_id', ['userId'])
@Index('idx_currency_preferences_user_id', ['userId'])
@Index('idx_currency_preferences_display_currency', ['displayCurrency'])
export class CurrencyPreference {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  userId!: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user!: User;

  @Column({
    type: 'enum',
    enum: DisplayCurrency,
    default: DisplayCurrency.USD,
    nullable: false,
  })
  displayCurrency!: DisplayCurrency;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
