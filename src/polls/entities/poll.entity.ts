import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Conversation } from '../../conversations/entities/conversation.entity';
import { User } from '../../users/entities/user.entity';
import { PollVote } from './poll-vote.entity';

@Entity('polls')
export class Poll {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  @Index('idx_polls_conversation_id')
  conversationId!: string;

  @Column({ type: 'uuid' })
  @Index('idx_polls_created_by')
  createdBy!: string;

  @Column({ type: 'varchar', length: 300 })
  question!: string;

  @Column({ type: 'jsonb' })
  options!: string[];

  @Column({ type: 'boolean', default: false })
  allowMultiple!: boolean;

  @Column({ type: 'boolean', default: false })
  isAnonymous!: boolean;

  @Column({ type: 'timestamp', nullable: true })
  @Index('idx_polls_expires_at')
  expiresAt!: Date | null;

  @Column({ type: 'boolean', default: false })
  @Index('idx_polls_is_closed')
  isClosed!: boolean;

  @ManyToOne(() => Conversation, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'conversationId' })
  conversation!: Conversation;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'createdBy' })
  creator!: User;

  @OneToMany(() => PollVote, (vote) => vote.poll)
  votes!: PollVote[];

  @CreateDateColumn({ type: 'timestamp' })
  createdAt!: Date;
}
