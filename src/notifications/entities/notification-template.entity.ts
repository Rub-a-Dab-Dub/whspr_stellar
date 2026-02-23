// src/notifications/entities/notification-template.entity.ts
import { User } from 'src/user/entities/user.entity';
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Unique,
  ManyToOne,
} from 'typeorm';

export enum NotificationType {
  SYSTEM = 'system',
  ALERT = 'alert',
  INFO = 'info',
}

export enum NotificationChannel {
  EMAIL = 'email',
  IN_APP = 'in_app',
  SMS = 'sms',
}

@Entity('notification_templates')
@Unique(['name'])
export class NotificationTemplate {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string; // unique

  @Column()
  title: string; // can include {{variable}}

  @Column()
  body: string; // can include {{variable}}

  @Column({ type: 'enum', enum: NotificationType })
  type: NotificationType;

  @Column({ type: 'enum', enum: NotificationChannel, array: true })
  channels: NotificationChannel[];

  @Column('text', { array: true })
  variables: string[]; // declared variable names

  @ManyToOne(() => User)
  createdBy: User;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
