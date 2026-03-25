import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { Conversation } from './conversation.entity';

@Entity('conversation_participants')
export class ConversationParticipant {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  conversationId: string;

  @Column()
  userId: string;

  @CreateDateColumn()
  joinedAt: Date;

  @Column({ type: 'datetime', nullable: true })
  lastReadAt?: Date;

  @Column({ default: false })
  isMuted: boolean;

  @ManyToOne(() => Conversation, (conversation) => conversation.participants, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'conversationId' })
  conversation: Conversation;
}
