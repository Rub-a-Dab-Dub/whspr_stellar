import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('two_factor_secrets')
export class TwoFactorSecret {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', unique: true })
  @Index('idx_two_factor_secrets_user_id')
  userId!: string;

  @Column({ type: 'text' })
  secretEncrypted!: string;

  @Column({ type: 'jsonb', default: () => "'[]'::jsonb" })
  backupCodeHashes!: string[];

  @Column({ type: 'boolean', default: false })
  isEnabled!: boolean;

  @Column({ type: 'timestamp', nullable: true })
  enabledAt!: Date | null;

  @CreateDateColumn({ type: 'timestamp' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamp' })
  updatedAt!: Date;
}
