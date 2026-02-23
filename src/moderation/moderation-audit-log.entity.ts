import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
  Index,
} from 'typeorm';
import { Message } from '../message/entities/message.entity';
import { User } from '../users/entities/user.entity';

@Entity('moderation_audit_logs')
export class ModerationAuditLog {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column('uuid')
  roomId!: string;

  @Index()
  @Column('uuid')
  messageId!: string;

  @ManyToOne(() => Message)
  message!: Message;

  @Column('varchar', { length: 64 })
  contentHash!: string;

  @Column('text')
  reason!: string;

  @Index()
  @Column('uuid')
  moderatorId!: string;

  @ManyToOne(() => User)
  moderator!: User;

  @Index()
  @CreateDateColumn()
  createdAt!: Date;
}
