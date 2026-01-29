import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { User } from '../../user/entities/user.entity';
import { Transfer } from './transfer.entity';

export enum DisputeStatus {
  OPEN = 'open',
  UNDER_REVIEW = 'under_review',
  RESOLVED = 'resolved',
  REJECTED = 'rejected',
  CLOSED = 'closed',
}

export enum DisputeReason {
  UNAUTHORIZED = 'unauthorized',
  WRONG_AMOUNT = 'wrong_amount',
  WRONG_RECIPIENT = 'wrong_recipient',
  NOT_RECEIVED = 'not_received',
  DUPLICATE = 'duplicate',
  FRAUD = 'fraud',
  OTHER = 'other',
}

@Entity('transfer_disputes')
@Index(['transferId', 'status'])
@Index(['initiatorId', 'createdAt'])
export class TransferDispute {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Transfer, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'transfer_id' })
  transfer: Transfer;

  @Column({ name: 'transfer_id' })
  transferId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'initiator_id' })
  initiator: User;

  @Column({ name: 'initiator_id' })
  initiatorId: string;

  @Column({
    type: 'enum',
    enum: DisputeReason,
  })
  reason: DisputeReason;

  @Column({ type: 'text' })
  description: string;

  @Column({
    type: 'enum',
    enum: DisputeStatus,
    default: DisputeStatus.OPEN,
  })
  status: DisputeStatus;

  @Column({ type: 'text', nullable: true })
  resolution: string;

  @Column({ name: 'resolved_by', nullable: true })
  resolvedBy: string;

  @Column({ name: 'resolved_at', type: 'timestamp', nullable: true })
  resolvedAt: Date;

  @Column({ type: 'simple-array', nullable: true })
  evidence: string[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
