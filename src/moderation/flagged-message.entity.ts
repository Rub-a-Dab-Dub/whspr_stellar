import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

export enum FlagStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected',
  AUTO_REMOVED = 'auto_removed',
}

@Entity('flagged_messages')
export class FlaggedMessage {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  messageId: string;

  @Column()
  roomId: string;

  @Column()
  userId: string; // author of the message

  @Column({ type: 'text' })
  content: string;

  @Column({ type: 'text' })
  reason: string;

  @Column({ type: 'enum', enum: FlagStatus, default: FlagStatus.PENDING })
  status: FlagStatus;

  @Column({ nullable: true })
  reportedBy: string; // user who reported

  @Column({ nullable: true })
  reviewedBy: string; // moderator who reviewed

  @Column({ type: 'text', nullable: true })
  moderatorNotes: string;

  @Column({ type: 'jsonb', nullable: true })
  metadata: {
    profanityScore?: number;
    spamScore?: number;
    detectionMethod?: string;
  };

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
