import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { ComplianceReportType } from './aml.enums';

@Entity('compliance_reports')
export class ComplianceReport {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column()
  period!: string; // YYYY-MM

  @Column({
    type: 'enum',
    enum: ComplianceReportType,
  })
  reportType!: ComplianceReportType;

  @Column({ type: 'jsonb' })
  transactionIds!: string[];

  @Column({ type: 'numeric', precision: 38, scale: 18 })
  totalAmount!: string;

  @Column({ type: 'text', nullable: true })
  pdfUrl!: string | null;

  @Column({ type: 'timestamp', nullable: true })
  submittedAt!: Date | null;

  @CreateDateColumn({ type: 'timestamp' })
  generatedAt!: Date;

  @UpdateDateColumn({ type: 'timestamp' })
  updatedAt!: Date;
}

