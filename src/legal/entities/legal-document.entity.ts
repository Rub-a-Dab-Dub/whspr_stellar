import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

export enum LegalDocumentType {
  TERMS = 'TERMS',
  PRIVACY = 'PRIVACY',
  COOKIE = 'COOKIE',
}

@Entity('legal_documents')
@Index('idx_legal_documents_type_active', ['type', 'isActive'])
@Index('idx_legal_documents_type_version', ['type', 'version'])
export class LegalDocument {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'enum', enum: LegalDocumentType })
  type!: LegalDocumentType;

  @Column({ type: 'varchar', length: 20 })
  version!: string;

  @Column({ type: 'timestamp' })
  effectiveDate!: Date;

  @Column({ type: 'text' })
  content!: string;

  @Column({ type: 'boolean', default: false })
  isActive!: boolean;

  @CreateDateColumn({ type: 'timestamp' })
  createdAt!: Date;
}
