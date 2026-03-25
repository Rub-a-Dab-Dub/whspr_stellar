import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

@Entity('messages')
export class Message {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'text' })
  content!: string;

  @Column({ type: 'uuid', nullable: true })
  @Index('idx_messages_group_id')
  groupId!: string | null;

  @Column({ type: 'uuid', nullable: true })
  @Index('idx_messages_sender_id')
  senderId!: string | null;

  @CreateDateColumn({ type: 'timestamp' })
  @Index('idx_messages_created_at')
  createdAt!: Date;
}
