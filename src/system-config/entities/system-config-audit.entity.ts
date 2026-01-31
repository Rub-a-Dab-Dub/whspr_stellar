import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

export enum SystemConfigAuditAction {
  CREATED = 'created',
  UPDATED = 'updated',
  ROLLED_BACK = 'rolled_back',
  KILL_SWITCH = 'kill_switch',
}

@Entity('system_config_audits')
@Index(['configId', 'createdAt'])
export class SystemConfigAudit {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', nullable: true })
  configId: string | null;

  @Column({ type: 'varchar', length: 200 })
  key: string;

  @Column({ type: 'enum', enum: SystemConfigAuditAction })
  action: SystemConfigAuditAction;

  @Column({ type: 'jsonb', nullable: true })
  oldValue: Record<string, any> | string | number | boolean | null;

  @Column({ type: 'jsonb', nullable: true })
  newValue: Record<string, any> | string | number | boolean | null;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, any> | null;

  @Column({ type: 'uuid', nullable: true })
  adminId: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  ipAddress: string | null;

  @Column({ type: 'text', nullable: true })
  userAgent: string | null;

  @CreateDateColumn()
  createdAt: Date;
}
