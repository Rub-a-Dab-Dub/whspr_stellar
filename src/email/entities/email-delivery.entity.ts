import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { EmailDeliveryStatus, EmailType } from '../enums/email-type.enum';

@Entity('email_deliveries')
export class EmailDelivery {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 40 })
  @Index('idx_email_deliveries_type')
  type!: EmailType;

  @Column({ type: 'varchar', length: 320 })
  @Index('idx_email_deliveries_to')
  to!: string;

  @Column({ type: 'varchar', length: 255 })
  subject!: string;

  @Column({ type: 'text' })
  html!: string;

  @Column({ type: 'text', nullable: true })
  text!: string | null;

  @Column({ type: 'varchar', length: 20, default: EmailDeliveryStatus.QUEUED })
  @Index('idx_email_deliveries_status')
  status!: EmailDeliveryStatus;

  @Column({ type: 'varchar', length: 120, nullable: true })
  providerMessageId!: string | null;

  @Column({ type: 'jsonb', default: () => "'{}'" })
  metadata!: Record<string, unknown>;

  @Column({ type: 'text', nullable: true })
  failureReason!: string | null;

  @Column({ type: 'int', default: 0 })
  attempts!: number;

  @Column({ type: 'timestamp with time zone', nullable: true })
  sentAt!: Date | null;

  @Column({ type: 'timestamp with time zone', nullable: true })
  deliveredAt!: Date | null;

  @CreateDateColumn({ type: 'timestamp with time zone' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamp with time zone' })
  updatedAt!: Date;
}
