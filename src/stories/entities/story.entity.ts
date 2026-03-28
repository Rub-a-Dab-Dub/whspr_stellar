import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';

export enum ContentType {
  TEXT = 'TEXT',
  IMAGE = 'IMAGE',
  VIDEO = 'VIDEO',
}

@Entity('stories')
@Index('idx_stories_user_expires', ['userId', 'expiresAt'])
export class Story {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column()
  userId!: string;

  @Column({
    type: 'enum',
    enum: ContentType,
  })
  contentType!: ContentType;

  @Column({ type: 'text', nullable: true })
  content!: string | null; // text content

  @Column({ nullable: true })
  mediaUrl!: string | null;

  @Column({ nullable: true })
  backgroundColor!: string | null;

  @Column({ default: 24 * 60 * 60 * 1000 }) // 24h in ms
  duration!: number;

  @Column({ default: 0 })
  viewCount!: number;

  @Column()
  expiresAt!: Date;

  @CreateDateColumn()
  createdAt!: Date;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user!: User;
}

