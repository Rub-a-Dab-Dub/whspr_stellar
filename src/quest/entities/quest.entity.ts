
import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn, OneToMany } from 'typeorm';
import { UserQuestProgress } from './user-quest-progress.entity';

export enum QuestType {
  DAILY = 'daily',
  WEEKLY = 'weekly',
  SPECIAL = 'special'
}

export enum RewardType {
  XP = 'xp',
  TOKEN = 'token',
  BOTH = 'both'
}

@Entity('quests')
export class Quest {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  description: string;

  @Column()
  requirement: string;

  @Column({ type: 'int' })
  requirementCount: number;

  @Column({ type: 'enum', enum: QuestType })
  questType: QuestType;

  @Column({ type: 'enum', enum: RewardType })
  rewardType: RewardType;

  @Column({ type: 'int' })
  rewardAmount: number;

  @Column({ type: 'timestamp' })
  activeUntil: Date;

  @Column({ default: true })
  isActive: boolean;

  @Column({ type: 'json', nullable: true })
  metadata?: Record<string, any>;

  @OneToMany(() => UserQuestProgress, progress => progress.quest)
  userProgress: UserQuestProgress[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
