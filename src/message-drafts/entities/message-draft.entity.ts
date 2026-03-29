import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  UpdateDateColumn,
  Index,
  Unique,
} from 'typeorm';

@Entity('message_drafts')
@Unique('uq_message_drafts_user_conversation', ['userId', 'conversationId'])
export class MessageDraft {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  @Index('idx_message_drafts_user_id')
  userId!: string;

  @Column({ type: 'uuid' })
  @Index('idx_message_drafts_conversation_id')
  conversationId!: string;

  @Column({ type: 'text' })
  content!: string;

  @Column({ type: 'simple-array', nullable: true })
  attachmentIds!: string[] | null;

  @Column({ type: 'uuid', nullable: true })
  replyToId!: string | null;

  @UpdateDateColumn({ type: 'timestamp' })
  updatedAt!: Date;
}
