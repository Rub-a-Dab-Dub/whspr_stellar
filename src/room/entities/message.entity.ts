// message.entity.ts
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';
import { Room } from './room.entity';
import { User } from '../../user/entities/user.entity';

export enum MessageType {
  TEXT = 'text',
  IMAGE = 'image',
  FILE = 'file',
  SYSTEM = 'system',
}

@Entity('messages')
@Index(['room', 'createdAt'])
export class Message {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ManyToOne(() => Room, { onDelete: 'CASCADE' })
  room!: Room;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  sender!: User;

  @Column({ type: 'text' })
  content!: string;

  @Column({ type: 'varchar', default: MessageType.TEXT })
  type!: MessageType;

  @Column({ type: 'varchar', nullable: true })
  fileUrl!: string;

  @Column({ type: 'varchar', nullable: true })
  fileName!: string;

  @Column({ default: false })
  isEdited!: boolean;

  @Column({ default: false })
  isDeleted!: boolean;

  @Column({ type: 'jsonb', default: {} })
  metadata!: Record<string, any>; // For mentions, replies, reactions, etc.

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
