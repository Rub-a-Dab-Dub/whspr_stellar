import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { LegalDocument } from './legal-document.entity';

@Entity('user_consents')
@Index('idx_user_consents_user_document', ['userId', 'documentId'], { unique: true })
@Index('idx_user_consents_user_id', ['userId'])
@Index('idx_user_consents_document_id', ['documentId'])
export class UserConsent {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  userId!: string;

  @Column({ type: 'uuid' })
  documentId!: string;

  @ManyToOne(() => LegalDocument, { eager: false })
  @JoinColumn({ name: 'documentId' })
  document!: LegalDocument;

  @Column({ type: 'varchar', length: 20 })
  version!: string;

  @Column({ type: 'varchar', length: 45, nullable: true })
  ipAddress!: string | null;

  @Column({ type: 'text', nullable: true })
  userAgent!: string | null;

  @CreateDateColumn({ type: 'timestamp' })
  acceptedAt!: Date;
}
