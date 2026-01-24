import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
} from 'typeorm';
import { Room } from './room.entity';
import { Message } from './message.entity';

@Entity('pinned_messages')
export class PinnedMessage {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ManyToOne(() => Room, { onDelete: 'CASCADE' })
  room!: Room;

  @ManyToOne(() => Message, { onDelete: 'CASCADE' })
  message!: Message;

  @CreateDateColumn()
  pinnedAt!: Date;
}
