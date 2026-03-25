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

export enum KeyType {
  X25519 = 'X25519',
  ED25519 = 'Ed25519',
}

@Entity('encryption_keys')
export class EncryptionKey {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  @Index('idx_encryption_keys_user_id')
  userId!: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user!: User;

  @Column({ type: 'text' })
  publicKey!: string;

  @Column({ type: 'enum', enum: KeyType, enumName: 'key_type_enum' })
  keyType!: KeyType;

  @Column({ type: 'int', default: 1 })
  version!: number;

  @Column({ type: 'boolean', default: true })
  @Index('idx_encryption_keys_is_active')
  isActive!: boolean;

  @Column({ type: 'boolean', default: false })
  registeredOnChain!: boolean;

  @CreateDateColumn({ type: 'timestamp' })
  createdAt!: Date;
}
