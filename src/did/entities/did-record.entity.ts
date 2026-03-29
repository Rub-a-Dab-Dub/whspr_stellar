import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
  OneToMany,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { VerifiableCredential } from './verifiable-credential.entity';

export type DidMethod = 'stellar' | 'key' | 'web';

@Entity('did_records')
export class DidRecord {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  @Index('IDX_did_records_user_id')
  userId!: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user!: User;

  @Column({ type: 'varchar', length: 255, unique: true })
  @Index('IDX_did_records_did', { unique: true })
  did!: string;

  @Column({ type: 'jsonb', default: {} })
  didDocument!: Record<string, unknown>;

  @Column({ type: 'varchar', length: 32 })
  method!: DidMethod;

  @Column({ type: 'boolean', default: false })
  isVerified!: boolean;

  @CreateDateColumn({ type: 'timestamp' })
  createdAt!: Date;

  @OneToMany(() => VerifiableCredential, (vc) => vc.didRecord)
  credentials!: VerifiableCredential[];
}
