import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

export enum QueueStatus {
  QUEUED = 'QUEUED',
  DELIVERED = 'DELIVERED',
  FAILED = 'FAILED',
}

@Entity('offline_message_queue')
@Index(['recipientId', 'status'])
@Index(['recipientId', 'queuedAt'])
export class OfflineMessageQueue {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar' })
  @Index()
  recipientId: string;

  @Column({ type: 'varchar' })
  messageId: string;

  @Column({ type: 'varchar' })
  conversationId: string;

  /**
   * Full message payload persisted for durability (messages > 1 h in Redis).
   */
  @Column({ type: 'jsonb', nullable: true })
  payload: Record<string, unknown> | null;

  @CreateDateColumn()
  queuedAt: Date;

  @Column({ type: 'timestamp', nullable: true })
  deliveredAt: Date | null;

  @Column({ type: 'int', default: 0 })
  attempts: number;

  @Column({ type: 'varchar', default: QueueStatus.QUEUED })
  status: QueueStatus;
}
