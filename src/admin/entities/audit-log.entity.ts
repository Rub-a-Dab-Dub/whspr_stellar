import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
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
}

@Entity('audit_logs')
export class AuditLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({
    type: 'enum',
    enum: AuditAction,
  })
  action: AuditAction;

  @Column({ type: 'uuid' })
  adminId: string; // Admin who performed the action

  @ManyToOne(() => User)
  @JoinColumn({ name: 'adminId' })
  admin: User;

  @Column({ type: 'uuid', nullable: true })
  targetUserId: string | null; // User who was affected

  @ManyToOne(() => User)
  @JoinColumn({ name: 'targetUserId' })
  targetUser: User | null;

  @Column({ type: 'text', nullable: true })
  details: string | null; // JSON string or description

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, any> | null;

  @Column({ type: 'inet', nullable: true })
  ipAddress: string | null;

  @Column({ type: 'text', nullable: true })
  userAgent: string | null;

  @CreateDateColumn()
  createdAt: Date;
}
