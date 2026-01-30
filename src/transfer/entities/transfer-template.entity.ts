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

@Entity('transfer_templates')
@Index(['userId', 'createdAt'])
@Index(['userId', 'name'])
export class TransferTemplate {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ name: 'user_id' })
  userId: string;

  @Column()
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ name: 'recipient_id' })
  recipientId: string;

  @Column('decimal', { precision: 18, scale: 8 })
  amount: string;

  @Column({ name: 'blockchain_network', default: 'stellar' })
  blockchainNetwork: string;

  @Column({ type: 'text', nullable: true })
  memo: string;

  @Column({ type: 'text', nullable: true })
  note: string;

  @Column({ name: 'use_count', default: 0 })
  useCount: number;

  @Column({ name: 'last_used_at', type: 'timestamp', nullable: true })
  lastUsedAt: Date;

  @Column({ name: 'is_favorite', default: false })
  isFavorite: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
