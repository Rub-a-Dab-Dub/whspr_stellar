<<<<<<< HEAD

=======
>>>>>>> 66270babe87cc62e819fbe1afca932360ca7a87c
import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
<<<<<<< HEAD
  ManyToOne,
  JoinColumn,
=======
>>>>>>> 66270babe87cc62e819fbe1afca932360ca7a87c
} from 'typeorm';
import { UserQuestProgress } from './user-quest-progress.entity';
import { User } from '../../user/entities/user.entity';

export enum QuestType {
  ONE_TIME = 'one_time',
  DAILY = 'daily',
  WEEKLY = 'weekly',
<<<<<<< HEAD
  REPEATABLE = 'repeatable',
}

export enum QuestStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  ARCHIVED = 'archived',
=======
  SPECIAL = 'special',
>>>>>>> 66270babe87cc62e819fbe1afca932360ca7a87c
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

  @Column({ type: 'timestamp', nullable: true })
  startDate?: Date;

  @Column({ type: 'timestamp', nullable: true })
  endDate?: Date;

  @Column({ type: 'uuid' })
  createdById: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'createdById' })
  createdBy: User;

  @Column({ type: 'json', nullable: true })
  metadata?: Record<string, any>;

<<<<<<< HEAD
  @Column({ default: false })
  deletedAt?: boolean;

=======
>>>>>>> 66270babe87cc62e819fbe1afca932360ca7a87c
  @OneToMany(() => UserQuestProgress, (progress) => progress.quest)
  userProgress: UserQuestProgress[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
