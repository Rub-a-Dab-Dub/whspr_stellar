import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
} from 'typeorm'

@Entity('onboarding_progress')
export class OnboardingProgress {
  @PrimaryColumn()
  userId: string

  @Column({ nullable: true })
  currentStep: string

  @Column({ type: 'text', array: true, default: [] })
  completedSteps: string[]

  @Column({ type: 'text', array: true, default: [] })
  skippedSteps: string[]

  @Column({ default: false })
  isCompleted: boolean

  @Column({ nullable: true })
  completedAt: Date

  @CreateDateColumn()
  startedAt: Date
}