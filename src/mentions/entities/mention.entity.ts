import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';

@Entity('mentions')
@Index('idx_mentions_message_id', ['messageId'])
@Index('idx_mentions_mentioned_user_id', ['mentionedUserId'])
@Index('idx_mentions_mentioned_by', ['mentionedBy'])
@Index('idx_mentions_conversation_id', ['conversationId'])
@Index('idx_mentions_is_read', ['isRead'])
@Index('idx_mentions_user_read', ['mentionedUserId', 'isRead'])
export class Mention {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  @Index('idx_mentions_msg_id')
  messageId!: string;

  @Column({ type: 'uuid' })
  @Index('idx_mentions_mentioned_user')
  mentionedUserId!: string;

  @Column({ type: 'uuid' })
  @Index('idx_mentions_by_user')
  mentionedBy!: string;

  @Column({ type: 'uuid' })
  @Index('idx_mentions_conv_id')
  conversationId!: string;

  @Column({ type: 'boolean', default: false })
  @Index('idx_mentions_read_status')
  isRead!: boolean;

  @CreateDateColumn({ type: 'timestamp' })
  @Index('idx_mentions_created_at')
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamp' })
  updatedAt!: Date;
}
