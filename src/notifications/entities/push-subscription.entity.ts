import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  Index,
} from 'typeorm';
import { User } from '../../user/entities/user.entity';

@Entity('push_subscriptions')
@Index(['userId', 'isActive'])
export class PushSubscription {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  user: User;

  @Column()
  endpoint: string;

  @Column('text')
  p256dhKey: string;

  @Column('text')
  authKey: string;

  @Column({ nullable: true })
  deviceType: string | null;

  @Column({ nullable: true })
  deviceName: string | null;

  @Column({ nullable: true })
  userAgent: string | null;

  @Column({ default: true })
  isActive: boolean;

  @Column({ nullable: true })
  lastUsedAt: Date | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}