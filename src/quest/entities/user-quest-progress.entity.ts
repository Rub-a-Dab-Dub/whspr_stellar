import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Unique,
} from 'typeorm';
import { Quest } from './quest.entity';

@Entity('user_quest_progress')
@Unique(['userId', 'questId'])
export class UserQuestProgress {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  userId: string;

  @Column()
  questId: string;

  @ManyToOne(() => Quest, (quest) => quest.userProgress)
  @JoinColumn({ name: 'questId' })
  quest: Quest;

  @Column({ type: 'int', default: 0 })
  currentProgress: number;

  @Column({ default: false })
  isCompleted: boolean;

  @Column({ default: false })
  isClaimed: boolean;

  @Column({ type: 'timestamp', nullable: true })
  completedAt?: Date;

  @Column({ type: 'timestamp', nullable: true })
  claimedAt?: Date;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
