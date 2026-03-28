import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  OneToOne,
  JoinColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';

export enum OnboardingStep {
  WALLET_CONNECTED = 'wallet_connected',
  PROFILE_COMPLETED = 'profile_completed',
  USERNAME_SET = 'username_set',
  FIRST_CONTACT_ADDED = 'first_contact_added',
  FIRST_MESSAGE_SENT = 'first_message_sent',
  ENCRYPTION_KEY_REGISTERED = 'encryption_key_registered',
  FIRST_TRANSFER = 'first_transfer',
}

@Entity('onboarding_progress')
@Index('idx_onboarding_user_id')
export class OnboardingProgress {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  userId!: string;

  @OneToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user!: User;

  @Column({
    type: 'enum',
    enum: OnboardingStep,
    default: OnboardingStep.WALLET_CONNECTED,
  })
  currentStep!: OnboardingStep;

  @Column({
    type: 'simple-array',
    default: [],
  })
  completedSteps!: OnboardingStep[];

  @Column({
    type: 'simple-array',
    default: [],
  })
  skippedSteps!: OnboardingStep[];

  @Column({ type: 'boolean', default: false })
  isCompleted!: boolean;

  @Column({ type: 'timestamp', nullable: true })
  completedAt!: Date | null;

  @Column({ type: 'timestamp', nullable: true })
  startedAt!: Date | null;

  @CreateDateColumn({ type: 'timestamp' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamp' })
  updatedAt!: Date;
}
