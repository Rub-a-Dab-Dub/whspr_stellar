import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { GroupEncryptionKey } from './group-encryption-key.entity';

@Entity('member_key_bundles')
@Index(['groupKeyId', 'memberId'])
@Index(['memberId'])
export class MemberKeyBundle {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  groupKeyId: string;

  @ManyToOne(() => GroupEncryptionKey, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'groupKeyId' })
  groupKey: GroupEncryptionKey;

  @Column()
  @Index()
  memberId: string;

  /**
   * The symmetric group key, encrypted with the member's public key
   * and encoded as base64.  The member decrypts this client-side.
   */
  @Column({ type: 'text' })
  encryptedGroupKey: string;

  /**
   * Optional device identifier to support multi-device members.
   */
  @Column({ nullable: true })
  deviceId: string | null;

  @CreateDateColumn()
  createdAt: Date;
}
