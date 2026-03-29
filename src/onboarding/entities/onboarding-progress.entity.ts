import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

export { OnboardingStep } from '../constants/onboarding-steps';

@Entity('onboarding_progress')
export class OnboardingProgress {
  @PrimaryColumn()
  userId!: string;

  @Column({ nullable: true })
  currentStep!: string | null;

  @Column({ type: 'text', array: true, default: [] })
  completedSteps!: string[];

  @Column({ type: 'text', array: true, default: [] })
  skippedSteps!: string[];

  @Column({ default: false })
  isCompleted!: boolean;

  @Column({ type: 'timestamp', nullable: true })
  completedAt!: Date | null;

  @CreateDateColumn()
  startedAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}