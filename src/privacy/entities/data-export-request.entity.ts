import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';

export enum ExportStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  READY = 'ready',
  EXPIRED = 'expired',
  FAILED = 'failed',
}

@Entity('data_export_requests')
export class DataExportRequest {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  @Index('idx_data_export_requests_user_id')
  userId!: string;

  @Column({
    type: 'enum',
    enum: ExportStatus,
    default: ExportStatus.PENDING,
  })
  @Index('idx_data_export_requests_status')
  status!: ExportStatus;

  @Column({ type: 'text', nullable: true })
  fileUrl!: string | null;

  @Column({ type: 'text', nullable: true })
  errorMessage!: string | null;

  @Column({ type: 'int', default: 0 })
  retryCount!: number;

  @CreateDateColumn({ type: 'timestamp' })
  requestedAt!: Date;

  @Column({ type: 'timestamp', nullable: true })
  completedAt!: Date | null;

  @Column({ type: 'timestamp', nullable: true })
  expiresAt!: Date | null;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user!: User;

  @UpdateDateColumn({ type: 'timestamp' })
  updatedAt!: Date;
}
