import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { User } from './user.entity';
import { XpAction } from '../constants/xp-actions.constants';

@Entity('xp_history')
@Index(['userId', 'createdAt'])
export class XpHistory {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  @Index()
  userId!: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'userId' })
  user!: User;

  @Column({ type: 'int' })
  amount!: number;

  @Column({
    type: 'enum',
    enum: XpAction,
  })
  action!: XpAction;

  @Column({ type: 'text', nullable: true })
  description!: string;

  @Column({ type: 'int', default: 0 })
  levelBefore!: number;

  @Column({ type: 'int', default: 0 })
  levelAfter!: number;

  @CreateDateColumn()
  createdAt!: Date;
}
