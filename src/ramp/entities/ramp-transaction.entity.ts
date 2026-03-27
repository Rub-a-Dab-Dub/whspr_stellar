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
import { User } from '../../users/entities/user.entity';

export enum RampType {
  DEPOSIT = 'DEPOSIT',
  WITHDRAWAL = 'WITHDRAWAL',
}

export enum RampStatus {
  PENDING = 'PENDING',
  PROCESSING = 'PROCESSING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  EXPIRED = 'EXPIRED',
}

@Entity('ramp_transactions')
export class RampTransaction {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  @Index('idx_ramp_user_id')
  userId!: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user!: User;

  @Column({ type: 'enum', enum: RampType })
  type!: RampType;

  @Column({ type: 'varchar', length: 12 })
  assetCode!: string;

  @Column({ type: 'numeric', precision: 20, scale: 7, nullable: true })
  amount!: string | null;

  @Column({ type: 'numeric', precision: 20, scale: 2, nullable: true })
  fiatAmount!: string | null;

  @Column({ type: 'varchar', length: 3, nullable: true })
  fiatCurrency!: string | null;

  @Column({ type: 'enum', enum: RampStatus, default: RampStatus.PENDING })
  @Index('idx_ramp_status')
  status!: RampStatus;

  @Column({ type: 'varchar', length: 255, nullable: true })
  anchorId!: string | null;

  @Column({ type: 'text', nullable: true })
  anchorUrl!: string | null;

  @Column({ type: 'varchar', length: 128, nullable: true })
  txHash!: string | null;

  @Column({ type: 'text', nullable: true })
  errorMessage!: string | null;

  @CreateDateColumn({ type: 'timestamp' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamp' })
  updatedAt!: Date;
}
