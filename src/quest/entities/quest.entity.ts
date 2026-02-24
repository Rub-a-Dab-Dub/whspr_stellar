import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { UserQuestProgress } from './user-quest-progress.entity';
import { User } from '../../user/entities/user.entity';

export enum QuestType {
  ONE_TIME = 'one_time',
  DAILY = 'daily',
  WEEKLY = 'weekly',
  REPEATABLE = 'repeatable',
  SPECIAL = 'special',
  SEASONAL = 'seasonal',
}

export enum QuestStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  ARCHIVED = 'archived',
}

export enum RewardType {
  XP = 'xp',
  TOKEN = 'token',
  BOTH = 'both',
}

@Entity('quests')
export class Quest {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  title: string;

  @Column()
  description: string;

  @Column({ type: 'enum', enum: QuestType })
  type: QuestType;

  @Column({ type: 'enum', enum: QuestStatus, default: QuestStatus.INACTIVE })
  status: QuestStatus;

  @Column({ type: 'int' })
  xpReward: number;

  @Column({ type: 'uuid', nullable: true })
  badgeRewardId?: string;

  @Column({ type: 'jsonb', nullable: true })
  condition?: Record<string, any>;

  @Column({ type: 'varchar', nullable: true })
  requirement?: string;

  @Column({ type: 'int', default: 1 })
  requirementCount: number;

  @Column({ type: 'int', default: 1 })
  difficulty: number;

  @Column({ type: 'uuid', nullable: true })
  requiredQuestId?: string;

  @ManyToOne(() => Quest, { nullable: true })
  @JoinColumn({ name: 'requiredQuestId' })
  requiredQuest?: Quest;

  @Column({ type: 'timestamp', nullable: true })
  startDate?: Date;

  @Column({ type: 'timestamp', nullable: true })
  endDate?: Date;

  @Column({ type: 'timestamp', nullable: true })
  activeUntil?: Date;

  @Column({ type: 'uuid' })
  createdById: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'createdById' })
  createdBy: User;

  @Column({ type: 'json', nullable: true })
  metadata?: Record<string, any>;

  @Column({ default: false })
  deletedAt?: boolean;

  @OneToMany(() => UserQuestProgress, (progress) => progress.quest)
  userProgress: UserQuestProgress[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
