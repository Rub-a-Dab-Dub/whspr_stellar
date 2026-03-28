import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Poll } from './poll.entity';
import { User } from '../../users/entities/user.entity';

@Entity('poll_votes')
export class PollVote {
  @PrimaryColumn({ type: 'uuid' })
  pollId!: string;

  @PrimaryColumn({ type: 'uuid' })
  userId!: string;

  @Column('int', { array: true })
  optionIndexes!: number[];

  @ManyToOne(() => Poll, (poll) => poll.votes, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'pollId' })
  poll!: Poll;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user!: User;

  @UpdateDateColumn({ type: 'timestamp' })
  votedAt!: Date;
}
