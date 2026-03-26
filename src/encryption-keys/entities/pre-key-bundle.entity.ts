import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { EncryptionKey } from './encryption-key.entity';

export interface PreKey {
  keyId: number;
  publicKey: string;
}

@Entity('pre_key_bundles')
export class PreKeyBundle {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  @Index('idx_pre_key_bundles_user_id')
  userId!: string;

  @Column({ type: 'uuid' })
  encryptionKeyId!: string;

  @ManyToOne(() => EncryptionKey, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'encryptionKeyId' })
  encryptionKey!: EncryptionKey;

  @Column({ type: 'jsonb', default: [] })
  preKeys!: PreKey[];

  @Column({ type: 'boolean', default: true })
  isValid!: boolean;

  @CreateDateColumn({ type: 'timestamp' })
  createdAt!: Date;
}
