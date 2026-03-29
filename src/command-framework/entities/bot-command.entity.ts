import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

export enum CommandScope {
  BUILT_IN = 'built_in',
  GLOBAL = 'global',
  BOT = 'bot',
}

@Entity('command_framework_bot_commands')
@Index('idx_bot_commands_command', ['command'])
export class BotCommand {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', nullable: true })
  @Index('idx_bot_commands_bot_id')
  botId?: string | null;

  @Column({ type: 'varchar', length: 64 })
  command!: string;

  @Column({ type: 'varchar', length: 255 })
  description!: string;

  @Column({ type: 'varchar', length: 255 })
  usage!: string;

  @Column({ 
    type: 'enum', 
    enum: CommandScope, 
    default: CommandScope.GLOBAL 
  })
  scope!: CommandScope;

  @Column({ type: 'boolean', default: true })
  isEnabled!: boolean;

  @CreateDateColumn({ type: 'timestamp' })
  createdAt!: Date;
}

