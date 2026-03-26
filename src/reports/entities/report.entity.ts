import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';

export enum ReportTargetType {
  USER = 'USER',
  MESSAGE = 'MESSAGE',
  GROUP = 'GROUP',
}

export enum ReportStatus {
  PENDING = 'PENDING',
  REVIEWED = 'REVIEWED',
  DISMISSED = 'DISMISSED',
  ACTIONED = 'ACTIONED',
}

@Entity('reports')
@Index('idx_reports_target_type_target_id', ['targetType', 'targetId'])
export class Report {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  reporterId!: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'reporterId' })
  reporter!: User;

  @Column({
    type: 'enum',
    enum: ReportTargetType,
  })
  targetType!: ReportTargetType;

  @Column({ type: 'uuid' })
  targetId!: string;

  @Column({ type: 'varchar', length: 120 })
  reason!: string;

  @Column({ type: 'text', nullable: true })
  description!: string | null;

  @Column({
    type: 'enum',
    enum: ReportStatus,
    default: ReportStatus.PENDING,
  })
  @Index('idx_reports_status')
  status!: ReportStatus;

  @Column({ type: 'uuid', nullable: true })
  reviewedBy!: string | null;

  @Column({ type: 'timestamp', nullable: true })
  reviewedAt!: Date | null;

  @CreateDateColumn({ type: 'timestamp' })
  @Index('idx_reports_created_at')
  createdAt!: Date;
}
