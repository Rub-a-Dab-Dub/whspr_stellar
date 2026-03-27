import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, Index, UpdateDateColumn } from 'typeorm';
import { User } from '../../users/entities/user.entity';

export enum SpamActionType {
  NONE = 'none',
  WARN = 'warn',
  THROTTLE = 'throttle',
  SUSPEND = 'suspend',
}

export interface SpamScoreFactors {
  messageFrequency?: {
    count: number;
    period: string; // "1h", "24h", "7d"
    threshold: number;
    weight: number;
  };
  contentHash?: {
    duplicateCount: number;
    consecutiveRepeats: number;
    weight: number;
  };
  bulkRecipients?: {
    recipientCount: number;
    threshold: number;
    weight: number;
  };
  reportCount?: {
    count: number;
    weight: number;
  };
  accountAge?: {
    ageInDays: number;
    threshold: number;
    weight: number;
  };
  toxicityScore?: {
    score: number; // 0-1
    weight: number;
  };
  ipReputation?: {
    score: number;
    weight: number;
  };
  [key: string]: any;
}

@Entity('spam_scores')
@Index(['userId'], { unique: true })
@Index(['score'], { where: `"score" > 0` })
@Index(['action'], { where: `"action" != 'none'` })
export class SpamScore {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid')
  userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE', eager: false })
  user: User;

  @Column('float', { default: 0, unsigned: true })
  score: number; // 0-100+ scale

  @Column('jsonb', { nullable: true })
  factors: SpamScoreFactors;

  @Column({
    type: 'enum',
    enum: SpamActionType,
    default: SpamActionType.NONE,
  })
  action: SpamActionType;

  @Column('timestamp', { nullable: true })
  triggeredAt: Date; // When action was triggered

  @Column('timestamp', { nullable: true })
  reviewedAt: Date; // When admin reviewed

  @Column('uuid', { nullable: true })
  reviewedBy: string; // Admin user ID

  @Column('text', { nullable: true })
  reviewNotes: string; // Admin review explanation

  @Column('boolean', { default: false })
  isFalsePositive: boolean; // Marked as false positive during review

  @Column('timestamp', { default: () => 'CURRENT_TIMESTAMP' })
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
