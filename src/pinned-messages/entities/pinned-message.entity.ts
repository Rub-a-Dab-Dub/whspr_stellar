import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
  Unique,
} from 'typeorm';
import { Conversation } from '../../conversations/entities/conversation.entity';
import { User } from '../../users/entities/user.entity';
import { MessageType } from '../../messages/entities/message.entity';

@Entity('pinned_messages')
@Unique('uq_pinned_messages_conversation_message', ['conversationId', 'messageId'])
@Index('idx_pinned_messages_conversation_order', ['conversationId', 'displayOrder'])
export class PinnedMessage {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  conversationId!: string;

  @ManyToOne(() => Conversation, (conversation) => conversation.pinnedMessages, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'conversationId' })
  conversation!: Conversation;

  @Column({ type: 'uuid' })
  messageId!: string;

  @Column({ type: 'uuid' })
  pinnedBy!: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'pinnedBy' })
  pinnedByUser!: User;

  @CreateDateColumn({ type: 'timestamp' })
  pinnedAt!: Date;

  @Column({ type: 'varchar', length: 500, nullable: true })
  note!: string | null;

  @Column({ type: 'int', default: 0 })
  displayOrder!: number;

  @Column({ type: 'text' })
  snapshotContent!: string;

  @Column({
    type: 'enum',
    enum: MessageType,
    default: MessageType.TEXT,
  })
  snapshotType!: MessageType;

  @Column({ type: 'uuid', nullable: true })
  snapshotSenderId!: string | null;

  @ManyToOne(() => User, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'snapshotSenderId' })
  snapshotSender!: User | null;

  @Column({ type: 'timestamp' })
  snapshotCreatedAt!: Date;
}
