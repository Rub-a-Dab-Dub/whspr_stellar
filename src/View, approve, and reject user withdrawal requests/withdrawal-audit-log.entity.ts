import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
} from 'typeorm';

export enum AuditAction {
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  AUTO_APPROVED = 'AUTO_APPROVED',
  QUEUED = 'QUEUED',
}

@Entity('withdrawal_audit_logs')
export class WithdrawalAuditLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'withdrawal_request_id' })
  withdrawalRequestId: string;

  @Column({ name: 'admin_id', nullable: true })
  adminId: string;

  @Column({ name: 'admin_username', nullable: true })
  adminUsername: string;

  @Column({ type: 'enum', enum: AuditAction })
  action: AuditAction;

  @Column({ name: 'reason', nullable: true })
  reason: string;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, any>;

  @Column({ name: 'ip_address', nullable: true })
  ipAddress: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
