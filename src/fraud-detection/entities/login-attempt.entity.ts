import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

export enum LoginAction {
  ALLOWED = 'ALLOWED',
  CHALLENGED = 'CHALLENGED',
  BLOCKED = 'BLOCKED',
}

@Entity('login_attempts')
@Index('idx_login_attempts_user_id', ['userId'])
@Index('idx_login_attempts_ip', ['ipAddress'])
@Index('idx_login_attempts_created_at', ['createdAt'])
export class LoginAttempt {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', nullable: true })
  userId!: string | null;

  @Column({ type: 'varchar', length: 45 })
  ipAddress!: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  country!: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  city!: string | null;

  @Column({ type: 'varchar', length: 10, nullable: true })
  countryCode!: string | null;

  @Column({ type: 'boolean', default: false })
  isVPN!: boolean;

  @Column({ type: 'boolean', default: false })
  isTor!: boolean;

  @Column({ type: 'boolean', default: false })
  isSuspicious!: boolean;

  @Column({ type: 'int', default: 0 })
  riskScore!: number;

  @Column({ type: 'enum', enum: LoginAction, default: LoginAction.ALLOWED })
  action!: LoginAction;

  @CreateDateColumn({ type: 'timestamp' })
  createdAt!: Date;
}
