import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

export enum ConversationExportFormat {
  TXT = 'TXT',
  JSON = 'JSON',
  HTML = 'HTML',
}

export enum ConversationExportStatus {
  PENDING = 'PENDING',
  PROCESSING = 'PROCESSING',
  READY = 'READY',
  EXPIRED = 'EXPIRED',
}

@Entity('conversation_export_jobs')
export class ConversationExportJob {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  @Index('idx_conversation_export_jobs_user_id')
  userId!: string;

  @Column({ type: 'uuid' })
  @Index('idx_conversation_export_jobs_conversation_id')
  conversationId!: string;

  @Column({
    type: 'enum',
    enum: ConversationExportFormat,
    default: ConversationExportFormat.JSON,
  })
  format!: ConversationExportFormat;

  @Column({
    type: 'enum',
    enum: ConversationExportStatus,
    default: ConversationExportStatus.PENDING,
  })
  @Index('idx_conversation_export_jobs_status')
  status!: ConversationExportStatus;

  @Column({ type: 'text', nullable: true })
  fileUrl!: string | null;

  @Column({ type: 'varchar', length: 512, nullable: true })
  fileKey!: string | null;

  @Column({ type: 'bigint', nullable: true })
  fileSize!: number | null;

  @CreateDateColumn({ type: 'timestamp' })
  requestedAt!: Date;

  @Column({ type: 'timestamp', nullable: true })
  completedAt!: Date | null;

  @Column({ type: 'timestamp', nullable: true })
  expiresAt!: Date | null;

  @UpdateDateColumn({ type: 'timestamp' })
  updatedAt!: Date;
}
