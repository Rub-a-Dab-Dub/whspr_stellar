import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';
import {
  AuditAction,
  AuditEventType,
  AuditOutcome,
  AuditSeverity,
} from './audit-log.entity';

@Entity('audit_log_archives')
@Index(['eventType', 'createdAt'])
@Index(['actorUserId', 'createdAt'])
export class AuditLogArchive {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({
    type: 'enum',
    enum: AuditEventType,
  })
  eventType: AuditEventType;

  @Column({
    type: 'enum',
    enum: AuditAction,
  })
  action: AuditAction;

  @Column({ type: 'uuid', nullable: true })
  actorUserId: string | null;

  @Column({ type: 'uuid', nullable: true })
  targetUserId: string | null;

  @Column({ type: 'text', nullable: true })
  resourceType: string | null;

  @Column({ type: 'text', nullable: true })
  resourceId: string | null;

  @Column({
    type: 'enum',
    enum: AuditOutcome,
    nullable: true,
  })
  outcome: AuditOutcome | null;

  @Column({
    type: 'enum',
    enum: AuditSeverity,
    nullable: true,
  })
  severity: AuditSeverity | null;

  @Column({ type: 'text', nullable: true })
  details: string | null;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, any> | null;

  @Column({ type: 'inet', nullable: true })
  ipAddress: string | null;

  @Column({ type: 'text', nullable: true })
  userAgent: string | null;

  @Column({ type: 'text', nullable: true })
  previousHash: string | null;

  @Column({ type: 'text', default: '' })
  hash: string;

  @CreateDateColumn()
  createdAt: Date;

  @Column({ type: 'timestamp' })
  archivedAt: Date;
}
