import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  Index,
  Unique,
} from 'typeorm';

@Entity('message_reactions')
@Unique(['messageId', 'userId', 'emoji']) // max 1 of each emoji per user per message
@Index(['messageId']) // fast aggregation by message
export class MessageReaction {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'message_id', type: 'uuid' })
  messageId: string;

  @ManyToOne('Message', { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'message_id' })
  message: unknown;

  @Column({ name: 'user_id' })
  userId: string;

  @ManyToOne('User', { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: unknown;

  /** Single emoji character, e.g. "🔥" */
  @Column({ type: 'varchar', length: 8 })
  emoji: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
