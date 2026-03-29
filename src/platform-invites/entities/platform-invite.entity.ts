import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { PlatformInviteRedemption } from './platform-invite-redemption.entity';

export enum PlatformInviteStatus {
  UNUSED = 'UNUSED',
  USED = 'USED',
  EXPIRED = 'EXPIRED',
  REVOKED = 'REVOKED',
}

@Entity('platform_invites')
@Index('idx_platform_invites_code', ['code'], { unique: true })
@Index('idx_platform_invites_created_by', ['createdBy'])
@Index('idx_platform_invites_status', ['status'])
export class PlatformInvite {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  createdBy!: string;

  /** 16-character URL-safe invite token */
  @Column({ type: 'varchar', length: 32 })
  code!: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  email!: string | null;

  @Column({ type: 'varchar', length: 24 })
  status!: PlatformInviteStatus;

  /** Total allowed redemptions (1 = single-use). */
  @Column({ type: 'int', default: 1 })
  maxUses!: number;

  @Column({ type: 'int', default: 0 })
  useCount!: number;

  @Column({ type: 'timestamp', nullable: true })
  expiresAt!: Date | null;

  @Column({ type: 'timestamp', nullable: true })
  revokedAt!: Date | null;

  @Column({ type: 'uuid', nullable: true })
  lastRedeemedByUserId!: string | null;

  @Column({ type: 'timestamp', nullable: true })
  lastRedeemedAt!: Date | null;

  @CreateDateColumn({ type: 'timestamp' })
  createdAt!: Date;

  @OneToMany(() => PlatformInviteRedemption, (r) => r.invite)
  redemptions!: PlatformInviteRedemption[];
}
