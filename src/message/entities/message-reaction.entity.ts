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
import { Message } from './message.entity';

@Entity('message_reactions')
@Index(['messageId', 'type'])
@Index(['messageId', 'userId'])
@Index(['userId', 'createdAt'])
@Unique(['messageId', 'userId', 'type'])
export class MessageReaction {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  messageId: string;

  @ManyToOne(() => Message, { eager: false, onDelete: 'CASCADE' })
  message: Message;

  @Column()
  userId: string;

  @ManyToOne(() => User, { eager: false, onDelete: 'CASCADE' })
  user: User;

  @Column()
  type: string; // Emoji or reaction type (e.g., '👍', '❤️', 'like', 'love')

  @Column({ default: false })
  isCustom: boolean; // Flag for custom reactions

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
