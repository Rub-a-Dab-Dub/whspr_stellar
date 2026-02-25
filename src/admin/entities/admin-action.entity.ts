import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  Index,
} from 'typeorm';
import { User } from '../../user/entities/user.entity';

export enum ActionType {
  BAN_USER = 'BAN_USER',
  REMOVE_ROOM = 'REMOVE_ROOM',
  REVIEW_REPORT = 'REVIEW_REPORT',
}

@Entity('admin_actions')
@Index(['adminId', 'createdAt'])
@Index(['actionType', 'createdAt'])
export class AdminAction {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'admin_id' })
  admin: User;

  @Column({ name: 'admin_id' })
  adminId: string;

  @Column({ type: 'enum', enum: ActionType, name: 'action_type' })
  actionType: ActionType;

  @Column({ name: 'target_id' })
  targetId: string;

  @Column({ type: 'text' })
  reason: string;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, any> | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
