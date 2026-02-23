import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, Index } from 'typeorm';

@Entity('archived_messages')
@Index(['roomId', 'archivedAt'])
export class ArchivedMessage {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  roomId: string;

  @Column()
  messageId: string;

  @Column()
  authorId: string;

  @Column('text')
  content: string;

  @Column('jsonb', { default: {} })
  metadata: Record<string, any>;

  @Column()
  originalCreatedAt: Date;

  @CreateDateColumn()
  archivedAt: Date;
}
