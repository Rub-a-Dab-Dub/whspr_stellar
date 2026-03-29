import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';

export enum ConnectionRequestStatus {
  PENDING = 'PENDING',
  ACCEPTED = 'ACCEPTED',
  DECLINED = 'DECLINED',
  WITHDRAWN = 'WITHDRAWN',
}

/**
 * Professional connection request (mutual, verified-style network).
 * Distinct from address-book / device contacts: requires explicit accept.
 */
@Entity('connection_requests')
@Index('idx_connection_requests_receiver_status', ['receiverId', 'status'])
@Index('idx_connection_requests_sender_status', ['senderId', 'status'])
export class ConnectionRequest {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  senderId!: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'senderId' })
  sender!: User;

  @Column({ type: 'uuid' })
  receiverId!: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'receiverId' })
  receiver!: User;

  @Column({ type: 'varchar', length: 300 })
  introMessage!: string;

  @Column({ type: 'varchar', length: 32 })
  status!: ConnectionRequestStatus;

  @CreateDateColumn({ type: 'timestamp' })
  createdAt!: Date;

  @Column({ type: 'timestamp', nullable: true })
  respondedAt!: Date | null;
}
