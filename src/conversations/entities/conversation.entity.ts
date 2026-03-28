import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from 'typeorm';
import { ConversationParticipant } from './conversation-participant.entity';
import { Message } from '../../messages/entities/message.entity';
import { InChatTransfer } from '../../in-chat-transfers/entities/in-chat-transfer.entity';
import { PinnedMessage } from '../../pinned-messages/entities/pinned-message.entity';

export enum ConversationType {
  DIRECT = 'direct',
  GROUP = 'group',
}

@Entity('conversations')
export class Conversation {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({
    type: 'enum',
    enum: ConversationType,
    default: ConversationType.DIRECT,
  })
  type!: ConversationType;

  @Column({ type: 'varchar', length: 120, nullable: true })
  title!: string | null;

  @Column({ type: 'varchar', length: 128, nullable: true })
  chainGroupId!: string | null;

  @OneToMany(() => ConversationParticipant, (participant) => participant.conversation)
  participants!: ConversationParticipant[];

  @OneToMany(() => Message, (message) => message.conversation)
  messages!: Message[];

  @OneToMany(() => InChatTransfer, (transfer) => transfer.conversation)
  transfers!: InChatTransfer[];

  @OneToMany(() => PinnedMessage, (pin) => pin.conversation)
  pinnedMessages!: PinnedMessage[];

  @CreateDateColumn({ type: 'timestamp' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamp' })
  updatedAt!: Date;
}
