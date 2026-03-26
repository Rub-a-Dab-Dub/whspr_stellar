import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';
import { AuditActionType } from '../constants/audit-actions';

@Entity('audit_logs')
export class AuditLog {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', nullable: true })
  @Index('idx_audit_logs_actor_id')
  actorId!: string | null;

  @Column({ type: 'uuid', nullable: true })
  @Index('idx_audit_logs_target_id')
  targetId!: string | null;

  @Column({ type: 'varchar', length: 64 })
  @Index('idx_audit_logs_action')
  action!: AuditActionType;

  @Column({ type: 'varchar', length: 128 })
  @Index('idx_audit_logs_resource')
  resource!: string;

  @Column({ type: 'uuid', nullable: true })
  resourceId!: string | null;

  @Column({ type: 'varchar', length: 45, nullable: true })
  ipAddress!: string | null;

  @Column({ type: 'text', nullable: true })
  userAgent!: string | null;

  @Column({ type: 'jsonb', nullable: true })
  metadata!: Record<string, unknown> | null;

  @CreateDateColumn({ type: 'timestamp' })
  @Index('idx_audit_logs_created_at')
  createdAt!: Date;
}
