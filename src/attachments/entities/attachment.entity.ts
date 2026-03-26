import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

@Entity('attachments')
export class Attachment {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  @Index('idx_attachments_message_id')
  messageId!: string;

  @Column({ type: 'uuid' })
  @Index('idx_attachments_uploader_id')
  uploaderId!: string;

  @Column({ type: 'text' })
  fileUrl!: string;

  @Column({ type: 'varchar', length: 512, unique: true })
  @Index('idx_attachments_file_key')
  fileKey!: string;

  @Column({ type: 'varchar', length: 255 })
  fileName!: string;

  @Column({ type: 'integer' })
  fileSize!: number;

  @Column({ type: 'varchar', length: 255 })
  mimeType!: string;

  @Column({ type: 'integer', nullable: true })
  width!: number | null;

  @Column({ type: 'integer', nullable: true })
  height!: number | null;

  @Column({ type: 'integer', nullable: true })
  duration!: number | null;

  @CreateDateColumn({ type: 'timestamp' })
  createdAt!: Date;
}
