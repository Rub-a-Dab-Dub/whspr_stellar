import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  BeforeUpdate,
  BeforeRemove,
  Index,
} from 'typeorm';
import { User } from '../../user/entities/user.entity';

export enum AuditAction {
  USER_BANNED = 'user.banned',
  USER_UNBANNED = 'user.unbanned',
  USER_SUSPENDED = 'user.suspended',
  USER_UNSUSPENDED = 'user.unsuspended',
  USER_VERIFIED = 'user.verified',
  USER_UNVERIFIED = 'user.unverified',
  USER_VIEWED = 'user.viewed',
  USER_UPDATED = 'user.updated',
  USER_DELETED = 'user.deleted',
  BULK_ACTION = 'bulk.action',
  IMPERSONATION_STARTED = 'impersonation.started',
  IMPERSONATION_ENDED = 'impersonation.ended',
  ROLE_ASSIGNED = 'role.assigned',
  ROLE_REVOKED = 'role.revoked',
  AUTH_LOGIN_SUCCESS = 'auth.login.success',
  AUTH_LOGIN_FAILED = 'auth.login.failed',
  AUTH_LOGOUT = 'auth.logout',
  AUTH_PASSWORD_RESET_REQUESTED = 'auth.password.reset.requested',
  AUTH_PASSWORD_RESET_COMPLETED = 'auth.password.reset.completed',
  AUTH_EMAIL_VERIFIED = 'auth.email.verified',
  TRANSFER_CREATED = 'transfer.created',
  TRANSFER_COMPLETED = 'transfer.completed',
  TRANSFER_FAILED = 'transfer.failed',
  AUDIT_LOG_VIEWED = 'audit.logs.viewed',
  AUDIT_LOG_EXPORTED = 'audit.logs.exported',
  DATA_EXPORT = 'data.exported',
}

export enum AuditEventType {
  ADMIN = 'admin',
  AUTH = 'auth',
  TRANSACTION = 'transaction',
  DATA_ACCESS = 'data_access',
  SYSTEM = 'system',
}

export enum AuditOutcome {
  SUCCESS = 'success',
  FAILURE = 'failure',
  PARTIAL = 'partial',
}

export enum AuditSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical',
}

@Entity('audit_logs')
@Index(['eventType', 'createdAt'])
@Index(['actorUserId', 'createdAt'])
export class AuditLog {
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

  @Column({ type: 'uuid', name: 'adminId', nullable: true })
  actorUserId: string | null; // User who performed the action

  @ManyToOne(() => User)
  @JoinColumn({ name: 'adminId' })
  actorUser: User;

  @Column({ type: 'uuid', nullable: true })
  targetUserId: string | null; // User who was affected

  @ManyToOne(() => User)
  @JoinColumn({ name: 'targetUserId' })
  targetUser: User | null;

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
  details: string | null; // JSON string or description

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

  @BeforeUpdate()
  preventUpdate() {
    throw new Error('Audit logs are immutable.');
  }

  @BeforeRemove()
  preventRemove() {
    throw new Error('Audit logs are immutable.');
  }
}
