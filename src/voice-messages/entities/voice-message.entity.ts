import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity('voice_messages')
@Index('idx_voice_messages_message_id', ['messageId'])
@Index('idx_voice_messages_uploader_id', ['uploaderId'])
export class VoiceMessage {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  messageId!: string;

  @Column({ type: 'uuid' })
  uploaderId!: string;

  @Column({ type: 'varchar', length: 512, unique: true })
  @Index('idx_voice_messages_file_key')
  fileKey!: string;

  @Column({ type: 'text' })
  fileUrl!: string;

  /** Duration in seconds; null until confirmed. */
  @Column({ type: 'integer', nullable: true })
  duration!: number | null;

  /** JSON array of amplitude samples for waveform rendering; null until processed. */
  @Column({ type: 'jsonb', nullable: true })
  waveformData!: number[] | null;

  @Column({ type: 'varchar', length: 100 })
  mimeType!: string;

  @Column({ type: 'integer' })
  fileSize!: number;

  /** True once the client has confirmed the upload completed. */
  @Column({ type: 'boolean', default: false })
  confirmed!: boolean;

  @CreateDateColumn({ type: 'timestamp' })
  createdAt!: Date;
}
