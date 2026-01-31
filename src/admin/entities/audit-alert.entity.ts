import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index } from 'typeorm';

export enum AuditAlertType {
  AUTH_BRUTE_FORCE = 'auth.brute_force',
  ADMIN_BULK_ACTION = 'admin.bulk_action',
  DATA_EXPORT = 'data.export',
  TRANSACTION_FAILURE_SPIKE = 'transaction.failure_spike',
}

export enum AuditAlertSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical',
}

@Entity('audit_alerts')
@Index(['alertType', 'createdAt'])
export class AuditAlert {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({
    type: 'enum',
    enum: AuditAlertType,
  })
  alertType: AuditAlertType;

  @Column({
    type: 'enum',
    enum: AuditAlertSeverity,
  })
  severity: AuditAlertSeverity;

  @Column({ type: 'text' })
  details: string;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, any> | null;

  @Column({ type: 'inet', nullable: true })
  ipAddress: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @Column({ type: 'timestamp', nullable: true })
  resolvedAt: Date | null;
}
