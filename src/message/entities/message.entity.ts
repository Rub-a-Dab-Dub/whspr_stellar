import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToMany,
  Index,
} from 'typeorm';
import { User } from '../../user/entities/user.entity';
import { MessageEditHistory } from './message-edit-history.entity';
import { MessageReaction } from './message-reaction.entity';
import { MessageType } from '../enums/message-type.enum';
import { Attachment } from './attachment.entity';

@Entity('messages')
@Index(['conversationId', 'createdAt'])
@Index(['authorId', 'createdAt'])
@Index(['isDeleted', 'conversationId'])
@Index(['type', 'conversationId'])
export class Message {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  conversationId: string;

  @Column()
  roomId: string;

  @ManyToOne(() => User, { eager: false, onDelete: 'CASCADE' })
  author: User;

  @Column()
  authorId: string;

  @Column('text')
  content: string;

  @Column({
    type: 'enum',
    enum: MessageType,
    default: MessageType.TEXT,
  })
  type: MessageType;

  @Column({ nullable: true })
  mediaUrl: string | null;

  @Column({ nullable: true })
  fileName: string | null;

  @Column('text', { nullable: true })
  originalContent: string | null;

  @Column({ default: false })
  isEdited: boolean;

  @Column({ nullable: true })
  editedAt: Date | null;

  @Column({ default: false })
  isDeleted: boolean;

  @Column({ nullable: true })
  deletedAt: Date | null;

  @Column({ nullable: true })
  deletedBy: string | null;

  @Column({ default: false })
  isHardDeleted: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @OneToMany(() => MessageEditHistory, (history) => history.message, {
    cascade: true,
    onDelete: 'CASCADE',
  })
  editHistory: MessageEditHistory[];

  @OneToMany(() => MessageReaction, (reaction) => reaction.message, {
    cascade: true,
    onDelete: 'CASCADE',
    eager: false,
  })
  reactions: MessageReaction[];

  @Column({ nullable: true })
  parentId: string | null;

  @ManyToOne(() => Message, (message) => message.replies, {
    onDelete: 'CASCADE',
    nullable: true,
  })
  parent: Message;

  @OneToMany(() => Message, (message) => message.parent)
  replies: Message[];

  @OneToMany(() => Attachment, (attachment) => attachment.message, {
    cascade: true,
    eager: true,
  })
  attachments: Attachment[];
}
