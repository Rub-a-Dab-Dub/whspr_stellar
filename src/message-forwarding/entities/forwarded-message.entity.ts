import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';

@Entity('forwarded_messages')
@Index('idx_forwarded_msg_original', ['originalMessageId'])
@Index('idx_forwarded_msg_forwarded', ['forwardedMessageId'])
@Index('idx_forwarded_msg_source_target', ['sourceConversationId', 'targetConversationId'])
@Index('idx_forwarded_msg_forward_chain', ['originalMessageId', 'forwardedMessageId'])
export class ForwardedMessage {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  @Index('idx_forwarded_msg_original_msg_id')
  originalMessageId!: string;

  @Column({ type: 'uuid' })
  @Index('idx_forwarded_msg_forwarded_msg_id')
  forwardedMessageId!: string;

  @Column({ type: 'uuid' })
  @Index('idx_forwarded_msg_forwarded_by')
  forwardedBy!: string;

  @Column({ type: 'uuid' })
  @Index('idx_forwarded_msg_source_conv_id')
  sourceConversationId!: string;

  @Column({ type: 'uuid' })
  @Index('idx_forwarded_msg_target_conv_id')
  targetConversationId!: string;

  @CreateDateColumn({ type: 'timestamp' })
  @Index('idx_forwarded_msg_created_at')
  forwardedAt!: Date;
}
