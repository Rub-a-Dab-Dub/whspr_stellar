import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { DidRecord } from './did-record.entity';

@Entity('verifiable_credentials')
export class VerifiableCredential {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  @Index('IDX_vc_user_id')
  userId!: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user!: User;

  @Column({ type: 'uuid' })
  @Index('IDX_vc_did_id')
  didId!: string;

  @ManyToOne(() => DidRecord, (did) => did.credentials, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'didId' })
  didRecord!: DidRecord;

  @Column({ type: 'varchar', length: 128 })
  credentialType!: string;

  @Column({ type: 'varchar', length: 255 })
  @Index('IDX_vc_issuer')
  issuer!: string;

  @Column({ type: 'jsonb', default: {} })
  credentialSubject!: Record<string, unknown>;

  @Column({ type: 'jsonb', default: {} })
  proof!: Record<string, unknown>;

  @Column({ type: 'timestamp' })
  issuedAt!: Date;

  @Column({ type: 'timestamp', nullable: true })
  expiresAt!: Date | null;

  @Column({ type: 'boolean', default: false })
  isRevoked!: boolean;

  @Column({ type: 'timestamp', nullable: true })
  revokedAt!: Date | null;

  /** When true, credential may be exposed on the holder's public profile (consent). */
  @Column({ type: 'boolean', default: false })
  showOnProfile!: boolean;

  @CreateDateColumn({ type: 'timestamp' })
  createdAt!: Date;
}
