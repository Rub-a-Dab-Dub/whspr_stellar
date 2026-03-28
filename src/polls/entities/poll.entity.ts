import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
  OneToMany,
} from 'typeorm';

export interface PollOption {
  id: number;
  text: string;
  voteCount?: number;
}

@Entity('polls')
@Index('idx_polls_conversation_id', ['conversationId'])
@Index('idx_polls_created_by', ['createdBy'])
@Index('idx_polls_expires_at', ['expiresAt'])
@Index('idx_polls_is_closed', ['isClosed'])
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
  @Index('idx_polls_conv_id')
  conversationId!: string;

  @Column({ type: 'uuid' })
  @Index('idx_polls_created_by_id')
  createdBy!: string;

  @Column({ type: 'varchar', length: 255 })
  question!: string;

  @Column({ type: 'jsonb' })
  options!: PollOption[];
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
  expiresAt!: Date | null;

  @Column({ type: 'boolean', default: false })
  @Index('idx_polls_is_closed_status')
  isClosed!: boolean;

  @CreateDateColumn({ type: 'timestamp' })
  @Index('idx_polls_created_at')
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamp' })
  updatedAt!: Date;

  @OneToMany(() => PollVote, (vote) => vote.poll, { lazy: true })
  votes!: PollVote[];
}

@Entity('poll_votes')
@Index('idx_poll_votes_poll_user', ['pollId', 'userId'], { unique: true })
@Index('idx_poll_votes_poll_id', ['pollId'])
@Index('idx_poll_votes_user_id', ['userId'])
export class PollVote {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  @Index('idx_poll_vote_poll_id')
  pollId!: string;

  @ManyToOne(() => Poll, (poll) => poll.votes, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'pollId' })
  poll!: Poll;

  @Column({ type: 'uuid' })
  @Index('idx_poll_vote_user_id')
  userId!: string;

  @Column({ type: 'int', array: true })
  optionIndexes!: number[];

  @CreateDateColumn({ type: 'timestamp' })
  @Index('idx_poll_votes_voted_at')
  votedAt!: Date;
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
