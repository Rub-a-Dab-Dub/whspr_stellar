import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  Index,
} from 'typeorm';

export enum MessageType {
  TEXT = 'TEXT',
  MEDIA = 'MEDIA',
  TIP = 'TIP',
  SYSTEM = 'SYSTEM',
}

@Entity('messages')
@Index(['roomId', 'createdAt'])
@Index(['senderId', 'createdAt'])
export class Message {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne('User', { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'sender_id' })
  sender: unknown;

  @Column({ name: 'sender_id' })
  senderId: string;

  @Column({ name: 'room_id' })
  roomId: string;

  @Column({
    type: 'enum',
    enum: MessageType,
    default: MessageType.TEXT,
  })
  type: MessageType;

  @Column({ type: 'text', nullable: true })
  content: string | null;

  /** IPFS CID / hash for media messages */
  @Column({ name: 'ipfs_hash', nullable: true, type: 'varchar', length: 128 })
  ipfsHash: string | null;

  /** ID of the message being replied to (threaded replies) */
  @Column({ name: 'reply_to_id', nullable: true, type: 'uuid' })
  @Index()
  replyToId: string | null;

  @Column({ name: 'payment_id', nullable: true })
  @Index()
  paymentId: string | null;

  @ManyToOne('Payment', { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'payment_id' })
  payment: unknown | null;

  @Column({ name: 'is_deleted', default: false })
  isDeleted: boolean;

  @Column({ name: 'edited_at', nullable: true, type: 'timestamp' })
  editedAt: Date | null;

  /** Soft-delete timestamp – set when message is removed */
  @Column({ name: 'deleted_at', nullable: true, type: 'timestamp' })
  deletedAt: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
