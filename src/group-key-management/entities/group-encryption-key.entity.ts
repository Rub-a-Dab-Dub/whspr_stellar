import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  Index,
} from 'typeorm';

@Entity('group_encryption_keys')
@Index(['groupId', 'isActive'])
export class GroupEncryptionKey {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  @Index()
  groupId: string;

  @Column({ type: 'int', default: 1 })
  keyVersion: number;

  /**
   * Raw symmetric key material – stored as hex.
   * In production this should be encrypted at rest via a KMS-managed key.
   */
  @Column({ type: 'text' })
  keyMaterial: string;

  @Column({ default: true })
  isActive: boolean;

  @CreateDateColumn()
  createdAt: Date;
}
