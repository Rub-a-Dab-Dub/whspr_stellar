import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
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
export class OnboardingProgress {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', unique: true })
  userId!: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user?: User;

  @Column({ type: 'varchar', nullable: true })
  currentStep!: string | null;

  @Column({ type: 'text', array: true, default: '{}' })
  completedSteps!: string[];

  @Column({ type: 'text', array: true, default: '{}' })
  skippedSteps!: string[];

  @Column({ default: false })
  isCompleted!: boolean;

  @Column({ type: 'timestamp', nullable: true })
  completedAt!: Date | null;

  @Column({ type: 'timestamp' })
  startedAt!: Date;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
