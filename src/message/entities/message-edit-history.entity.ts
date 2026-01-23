import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  ManyToOne,
} from 'typeorm';
import { Message } from './message.entity';

@Entity('message_edit_history')
export class MessageEditHistory {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Message, (message) => message.editHistory, {
    eager: false,
    onDelete: 'CASCADE',
  })
  message: Message;

  @Column()
  messageId: string;

  @Column('text')
  previousContent: string;

  @Column('text')
  newContent: string;

  @CreateDateColumn()
  editedAt: Date;
}
