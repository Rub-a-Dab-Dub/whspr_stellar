import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { Anchor } from './anchor.entity';

export enum AnchorTxType {
  DEPOSIT = 'DEPOSIT',
  WITHDRAWAL = 'WITHDRAWAL',
}

export enum AnchorTxStatus {
  PENDING = 'PENDING',
  PROCESSING = 'PROCESSING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  EXPIRED = 'EXPIRED',
}

@Entity('anchor_transactions')
export class AnchorTransaction {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  @Index('idx_anchor_tx_user_id')
  userId!: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user!: User;

  @Column({ type: 'uuid' })
  @Index('idx_anchor_tx_anchor_id')
  anchorId!: string;

  @ManyToOne(() => Anchor, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'anchorId' })
  anchor!: Anchor;

  @Column({ type: 'enum', enum: AnchorTxType })
  type!: AnchorTxType;

  @Column({ type: 'varchar', length: 12 })
  assetCode!: string;

  @Column({ type: 'numeric', precision: 20, scale: 7, nullable: true })
  amount!: string | null;

  @Column({ type: 'numeric', precision: 20, scale: 2, nullable: true })
  fiatAmount!: string | null;

  @Column({ type: 'varchar', length: 3, nullable: true })
  fiatCurrency!: string | null;

  @Column({ type: 'varchar', length: 128, nullable: true })
  stellarTxHash!: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  anchorTxId!: string | null;

  @Column({ type: 'enum', enum: AnchorTxStatus, default: AnchorTxStatus.PENDING })
  @Index('idx_anchor_tx_status')
  status!: AnchorTxStatus;

  @CreateDateColumn({ type: 'timestamp' })
  createdAt!: Date;
}
