import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  Index,
  Unique,
} from 'typeorm';
import { User } from '../../user/entities/user.entity';
import { NotificationType, NotificationChannel } from '../enums/notification-type.enum';

@Entity('notification_preferences')
@Unique(['userId', 'type', 'channel'])
@Index(['userId', 'type'])
export class NotificationPreference {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  user: User;

  @Column({
    type: 'enum',
    enum: NotificationType,
  })
  type: NotificationType;

  @Column({
    type: 'enum',
    enum: NotificationChannel,
  })
  channel: NotificationChannel;

  @Column({ default: true })
  isEnabled: boolean;

  @Column({ type: 'time', nullable: true })
  quietHoursStart: string | null;

  @Column({ type: 'time', nullable: true })
  quietHoursEnd: string | null;

  @Column('simple-array', { nullable: true })
  mutedRooms: string[] | null;

  @Column('simple-array', { nullable: true })
  mutedUsers: string[] | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}