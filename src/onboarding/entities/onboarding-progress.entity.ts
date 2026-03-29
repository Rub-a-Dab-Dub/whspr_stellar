import { Entity, PrimaryColumn, Column, CreateDateColumn } from 'typeorm';

export enum OnboardingStep {
  WALLET_CONNECTED = 'wallet_connected',
  PROFILE_COMPLETED = 'profile_completed',
  USERNAME_SET = 'username_set',
  PREFERENCES_SET = 'preferences_set',
  CONTACTS_IMPORTED = 'contacts_imported',
}

@Entity('onboarding_progress')
export class OnboardingProgress {
  @PrimaryColumn('uuid')
  userId!: string;

  @Column({ type: 'varchar', nullable: true })
  currentStep!: string | null;

  @Column({ type: 'text', array: true, default: '{}' })
  completedSteps!: string[];

  @Column({ type: 'text', array: true, default: '{}' })
  skippedSteps!: string[];

  @Column({ default: false })
  isCompleted!: boolean;

  @Column({ type: 'timestamptz', nullable: true })
  completedAt!: Date | null;

  @CreateDateColumn({ type: 'timestamptz' })
  startedAt!: Date;
}
