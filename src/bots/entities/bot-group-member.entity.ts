import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import { Bot } from './bot.entity';

@Entity('bot_group_members')
@Unique('uq_bot_group_members_group_bot', ['groupId', 'botId'])
export class BotGroupMember {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  @Index('idx_bot_group_members_group_id')
  groupId!: string;

  @Column({ type: 'uuid' })
  @Index('idx_bot_group_members_bot_id')
  botId!: string;

  @Column({ type: 'boolean', default: true })
  isBot!: boolean;

  @ManyToOne(() => Bot, (bot) => bot.groupMemberships, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'botId' })
  bot!: Bot;

  @CreateDateColumn({ type: 'timestamp' })
  createdAt!: Date;
}
