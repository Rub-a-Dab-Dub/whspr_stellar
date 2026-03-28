import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
  OneToOne,
} from 'typeorm';
import { Conversation } from '../../conversations/entities/conversation.entity';
import { User } from '../../users/entities/user.entity';
import { InChatTransfer } from '../../in-chat-transfers/entities/in-chat-transfer.entity';

export enum MessageType {
  TEXT = 'text',
  TRANSFER = 'transfer',
  SYSTEM = 'system',
  STICKER = 'sticker',
  GIF = 'gif',
}

@Entity('messages')
export class Message {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  @Index('idx_messages_conversation_id')
  conversationId!: string;

  @Column({ type: 'uuid', nullable: true })
  @Index('idx_messages_sender_id')
  senderId!: string | null;

  @ManyToOne(() => Conversation, (conversation) => conversation.messages, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'conversationId' })
  conversation!: Conversation;

  @ManyToOne(() => User, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'senderId' })
  sender!: User | null;

  @Column({
    type: 'enum',
    enum: MessageType,
    default: MessageType.TEXT,
  })
  type!: MessageType;

  @Column({ type: 'text' })
  content!: string;

  @OneToOne(() => InChatTransfer, (transfer) => transfer.message)
  transfer!: InChatTransfer | null;

  @CreateDateColumn({ type: 'timestamp' })
  createdAt!: Date;
}
