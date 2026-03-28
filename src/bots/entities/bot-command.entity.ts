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

@Entity('bot_commands')
@Unique('uq_bot_commands_bot_command', ['botId', 'command'])
export class BotCommand {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  @Index('idx_bot_commands_bot_id')
  botId!: string;

  @Column({ type: 'varchar', length: 64 })
  command!: string;

  @Column({ type: 'varchar', length: 255 })
  description!: string;

  @Column({ type: 'varchar', length: 255 })
  usage!: string;

  @ManyToOne(() => Bot, (bot) => bot.commands, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'botId' })
  bot!: Bot;

  @CreateDateColumn({ type: 'timestamp' })
  createdAt!: Date;
}
