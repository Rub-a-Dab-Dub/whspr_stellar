import { Column, Entity, Index, PrimaryGeneratedColumn, Unique } from 'typeorm';

export enum ContactHashType {
  PHONE = 'PHONE',
  EMAIL = 'EMAIL',
}

@Entity('user_contact_hash_index')
@Unique(['userId', 'type', 'hash'])
@Index(['hash', 'type'])
@Index(['userId'])
export class UserContactHashIndex {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  userId!: string;

  @Column({ type: 'enum', enum: ContactHashType })
  type!: ContactHashType;

  @Column({ type: 'varchar', length: 64 })
  hash!: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  username!: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  displayName!: string | null;

  @Column({ type: 'text', nullable: true })
  avatarUrl!: string | null;
}
