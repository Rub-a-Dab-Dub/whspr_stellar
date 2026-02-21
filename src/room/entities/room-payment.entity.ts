import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
  UpdateDateColumn,
  JoinColumn,
} from 'typeorm';
import { Room } from './room.entity';
import { User } from '../../users/entities/user.entity';

export enum PaymentStatus {
  PENDING = 'pending',
  COMPLETED = 'completed',
  FAILED = 'failed',
  REFUNDED = 'refunded',
  EXPIRED = 'expired',
}

@Entity('room_payments')
export class RoomPayment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Room, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'room_id' })
  room: Room;

  @Column({ name: 'room_id' })
  roomId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ name: 'user_id' })
  userId: string;

  @Column('decimal', { precision: 18, scale: 8 })
  amount: string;

  @Column('decimal', { precision: 18, scale: 8, name: 'platform_fee' })
  platformFee: string;

  @Column('decimal', { precision: 18, scale: 8, name: 'creator_amount' })
  creatorAmount: string;

  @Column({ name: 'transaction_hash', unique: true })
  transactionHash: string;

  @Column({ name: 'blockchain_network', default: 'ethereum' })
  blockchainNetwork: string;

  @Column({
    type: 'enum',
    enum: PaymentStatus,
    default: PaymentStatus.PENDING,
  })
  status: PaymentStatus;

  @Column({ name: 'access_granted', default: false })
  accessGranted: boolean;

  @Column({ name: 'access_expires_at', type: 'timestamp', nullable: true })
  accessExpiresAt: Date;

  @Column({ name: 'refund_transaction_hash', nullable: true })
  refundTransactionHash: string;

  @Column({ name: 'refunded_at', type: 'timestamp', nullable: true })
  refundedAt: Date;

  @Column({ type: 'text', nullable: true })
  notes: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
