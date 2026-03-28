import { Column, CreateDateColumn, Entity, Index, OneToMany, PrimaryGeneratedColumn } from 'typeorm';
import { BotCommand } from './bot-command.entity';
import { BotGroupMember } from './bot-group-member.entity';

@Entity('bots')
export class Bot {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  @Index('idx_bots_owner_id')
  ownerId!: string;

  @Column({ type: 'varchar', length: 120 })
  name!: string;

  @Column({ type: 'varchar', length: 64, unique: true })
  @Index('idx_bots_username')
  username!: string;

  @Column({ type: 'text', nullable: true })
  avatarUrl!: string | null;

  @Column({ type: 'text' })
  webhookUrl!: string;

  @Column({ type: 'varchar', length: 255 })
  webhookSecret!: string;

  @Column({ type: 'text', array: true, default: '{}' })
  scopes!: string[];

  @Column({ type: 'boolean', default: true })
  isActive!: boolean;

  @OneToMany(() => BotCommand, (command) => command.bot)
  commands!: BotCommand[];

  @OneToMany(() => BotGroupMember, (membership) => membership.bot)
  groupMemberships!: BotGroupMember[];

  @CreateDateColumn({ type: 'timestamp' })
  createdAt!: Date;
}
