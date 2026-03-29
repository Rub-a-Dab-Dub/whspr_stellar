import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { Transaction } from '../../transactions/entities/transaction.entity';
import { User } from '../../users/entities/user.entity';
import {
  AmlFlagType,
  AmlRiskLevel,
  AmlFlagStatus,
} from './aml.enums';

@Entity('aml_flags')
@Index('idx_aml_flags_status', ['status'])
@Index('idx_aml_flags_user', ['userId'])
@Index('idx_aml_flags_transaction', ['transactionId'])
@Index('idx_aml_flags_created', ['createdAt'])
export class AmlFlag {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  @Index()
  transactionId!: string;

  @ManyToOne(() => Transaction, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'transactionId' })
  transaction!: Transaction;

  @Column({ type: 'uuid', nullable: true })
  userId!: string | null; // fromAddress user if known

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'userId' })
  user!: User | null;

  @Column({
    type: 'enum',
    enum: AmlFlagType,
  })
  flagType!: AmlFlagType;

  @Column({
    type: 'enum',
    enum: AmlRiskLevel,
  })
  riskLevel!: AmlRiskLevel;

  @Column({
    type: 'enum',
    enum: AmlFlagStatus,
    default: AmlFlagStatus.OPEN,
  })
  status!: AmlFlagStatus;

  @Column({ type: 'uuid', nullable: true })
  reviewedBy!: string | null;

  @Column({ type: 'text', nullable: true })
  reviewNotes!: string | null;

  @CreateDateColumn({ type: 'timestamp' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamp' })
  updatedAt!: Date;
}

