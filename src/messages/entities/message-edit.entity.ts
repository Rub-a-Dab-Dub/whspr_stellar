import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  Index,
} from 'typeorm';
import { Message } from './message.entity';

@Entity('message_edits')
@Index(['messageId', 'editedAt'])
export class MessageEdit {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Message, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'message_id' })
  message: Message;

  @Column({ name: 'message_id' })
  messageId: string;

  @Column({ type: 'text', name: 'previous_content', nullable: true })
  previousContent: string | null;

  @ManyToOne('User', { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'edited_by' })
  editedBy: unknown;

  @Column({ name: 'edited_by', nullable: true })
  editedById: string | null;

  @CreateDateColumn({ name: 'edited_at' })
  editedAt: Date;
}
