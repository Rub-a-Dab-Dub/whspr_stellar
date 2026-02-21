import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('quest_progress')
export class QuestProgress {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  userId: string;

  @Column()
  questId: string;

  @Column({ default: 0 })
  progress: number;

  @Column()
  target: number;

  @Column({ default: false })
  completed: boolean;

  @Column({ type: 'float', default: 0 })
  percentage: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
