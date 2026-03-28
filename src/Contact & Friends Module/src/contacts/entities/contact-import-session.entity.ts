import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';

export interface ContactImportHashes {
  phoneHashes: string[];
  emailHashes: string[];
}

@Entity('contact_import_sessions')
@Unique(['ownerId'])
@Index(['ownerId'])
@Index(['expiresAt'])
export class ContactImportSession {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  ownerId!: string;

  @Column({ type: 'jsonb' })
  hashes!: ContactImportHashes;

  @Column({ type: 'timestamp' })
  expiresAt!: Date;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
