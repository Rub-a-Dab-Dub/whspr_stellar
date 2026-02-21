import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

export enum RuleType {
  PROFANITY = 'profanity',
  SPAM = 'spam',
  LINK_SPAM = 'link_spam',
  CUSTOM = 'custom',
}

export enum RuleAction {
  WARN = 'warn',
  DELETE = 'delete',
  MUTE = 'mute',
  BAN = 'ban',
}

@Entity('moderation_rules')
export class ModerationRule {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column({ type: 'enum', enum: RuleType })
  type: RuleType;

  @Column({ type: 'enum', enum: RuleAction })
  action: RuleAction;

  @Column({ type: 'jsonb', nullable: true })
  config: {
    patterns?: string[];
    threshold?: number;
    duration?: number; // in minutes for mute/ban
  };

  @Column({ default: true })
  isActive: boolean;

  @Column({ default: 0 })
  priority: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
