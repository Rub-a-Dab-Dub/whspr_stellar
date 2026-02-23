import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn, Index } from 'typeorm';
import { User } from '../../user/entities/user.entity';

@Entity('wallets')
export class Wallet {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  @Index()
  address: string;

  @Column({ type: 'text' })
  encryptedPrivateKey: string;

  @Column({ type: 'text' })
  sessionKey: string;

  @Column({ default: 0 })
  nonce: number;

  @Column({ type: 'uuid' })
  @Index()
  userId: string;

  @Column({ default: true })
  isActive: boolean;

  @Column({ default: false })
  isPrimary: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;
}
