import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { User } from '../../user/entities/user.entity';

export enum DataAccessAction {
  VIEW = 'view',
  EXPORT = 'export',
  UPDATE = 'update',
  DELETE = 'delete',
}

@Entity('data_access_logs')
@Index(['actorUserId', 'createdAt'])
@Index(['targetUserId', 'createdAt'])
export class DataAccessLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', nullable: true })
  actorUserId: string | null;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'actorUserId' })
  actorUser: User;

  @Column({ type: 'uuid', nullable: true })
  targetUserId: string | null;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'targetUserId' })
  targetUser: User | null;

  @Column({
    type: 'enum',
    enum: DataAccessAction,
  })
  action: DataAccessAction;

  @Column({ type: 'text' })
  resourceType: string;

  @Column({ type: 'text', nullable: true })
  resourceId: string | null;

  @Column({ type: 'text', nullable: true })
  details: string | null;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, any> | null;

  @Column({ type: 'inet', nullable: true })
  ipAddress: string | null;

  @Column({ type: 'text', nullable: true })
  userAgent: string | null;

  @CreateDateColumn()
  createdAt: Date;
}
