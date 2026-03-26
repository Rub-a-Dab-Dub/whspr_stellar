import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';

export enum ConsentType {
  MARKETING = 'marketing',
  ANALYTICS = 'analytics',
  COOKIES = 'cookies',
  PROFILING = 'profiling',
  THIRD_PARTY = 'third_party',
}

@Entity('consent_records')
export class ConsentRecord {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  @Index('idx_consent_records_user_id')
  userId!: string;

  @Column({
    type: 'enum',
    enum: ConsentType,
  })
  @Index('idx_consent_records_type')
  consentType!: ConsentType;

  @Column({ type: 'boolean' })
  isGranted!: boolean;

  @Column({ type: 'varchar', length: 45, nullable: true })
  ipAddress!: string | null;

  @Column({ type: 'text', nullable: true })
  userAgent!: string | null;

  @CreateDateColumn({ type: 'timestamp' })
  grantedAt!: Date;

  @Column({ type: 'timestamp', nullable: true })
  revokedAt!: Date | null;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user!: User;
}
