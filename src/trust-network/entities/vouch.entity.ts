import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  Index,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';

@Entity('vouches')
@Index('idx_vouches_voucher_vouched', ['voucherId', 'vouchedId'], { unique: true })
export class Vouch {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  voucherId!: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'voucherId' })
  voucher!: User;

  @Column({ type: 'uuid' })
  vouchedId!: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'vouchedId' })
  vouched!: User;

  @Column({ type: 'decimal', precision: 3, scale: 2 })
  trustScore!: number; // 1-5

  @Column({ type: 'text', nullable: true })
  comment!: string | null;

  @Column({ type: 'boolean', default: false })
  isRevoked!: boolean;

  @Column({ type: 'timestamp', nullable: true })
  revokedAt!: Date | null;

  @CreateDateColumn()
  createdAt!: Date;
}
