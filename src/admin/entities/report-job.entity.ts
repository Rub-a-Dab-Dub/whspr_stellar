import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

export enum ReportType {
  REVENUE = 'revenue',
  USERS = 'users',
  TRANSACTIONS = 'transactions',
  ROOMS = 'rooms',
}

export enum ReportFormat {
  CSV = 'csv',
  JSON = 'json',
}

export enum ReportJobStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  COMPLETE = 'complete',
  FAILED = 'failed',
}

@Entity('report_jobs')
export class ReportJob {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({
    type: 'enum',
    enum: ReportType,
  })
  type: ReportType;

  @Column({
    type: 'enum',
    enum: ReportFormat,
  })
  format: ReportFormat;

  @Column({
    type: 'enum',
    enum: ReportJobStatus,
    default: ReportJobStatus.PENDING,
  })
  status: ReportJobStatus;

  @Column({ type: 'timestamp' })
  startDate: Date;

  @Column({ type: 'timestamp' })
  endDate: Date;

  @Column({ type: 'uuid' })
  requestedBy: string;

  @Column({ type: 'text', nullable: true })
  filePath: string | null;

  @Column({ type: 'text', nullable: true })
  errorMessage: string | null;

  @Column({ type: 'timestamp', nullable: true })
  completedAt: Date | null;

  @Column({ type: 'timestamp', nullable: true })
  expiresAt: Date | null;

  @Column({ type: 'boolean', default: false })
  isScheduled: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
