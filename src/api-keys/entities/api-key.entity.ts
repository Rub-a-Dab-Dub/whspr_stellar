import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

@Entity('api_keys')
export class ApiKey {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  @Index('idx_api_keys_user_id')
  userId!: string;

  @Column({ type: 'varchar', length: 64 })
  @Index('idx_api_keys_key_hash')
  keyHash!: string;

  @Column({ type: 'varchar', length: 24 })
  @Index('idx_api_keys_prefix')
  prefix!: string;

  @Column({ type: 'varchar', length: 120 })
  label!: string;

  @Column({ type: 'jsonb', default: () => "'[]'" })
  scopes!: string[];

  @Column({ type: 'timestamp with time zone', nullable: true })
  lastUsedAt!: Date | null;

  @Column({ type: 'timestamp with time zone', nullable: true })
  expiresAt!: Date | null;

  @Column({ type: 'timestamp with time zone', nullable: true })
  revokedAt!: Date | null;

  @CreateDateColumn({ type: 'timestamp with time zone' })
  createdAt!: Date;
}
