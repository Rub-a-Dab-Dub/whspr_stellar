import { AuditLog } from 'src/audit-log/entities/audit-log.entity';
import { Pseudonym } from 'src/pseudonym/entities/pseudonym.entity';
import { Wallet } from 'src/wallet/entities/wallet.entity';
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
  OneToOne,
  Index,
} from 'typeorm';

@Entity('users')
@Index(['email'])
@Index(['username'])
@Index(['level'])
@Index(['lastActivityAt'])
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  username: string;

  @Column({ unique: true })
  email: string;

  @Column()
  passwordHash: string;

  @Column({ nullable: true })
  bio: string;

  @Column({ nullable: true })
  avatarUrl: string;

  @Column({ default: 1 })
  level: number;

  @Column({ default: 0 })
  xp: number;

  @Column({ default: false })
  isVerified: boolean;

  @Column({ default: false })
  isSuspended: boolean;

  @Column({ nullable: true })
  suspensionReason: string;

  @Column({ default: false })
  isDeleted: boolean;

  @Column({ type: 'timestamp', nullable: true })
  deletedAt: Date;

  @Column({ type: 'timestamp', nullable: true })
  lastActivityAt: Date;

  @Column({ type: 'simple-array', default: '' })
  badges: string[];

  @Column({ default: 0 })
  messagesSent: number;

  @Column({ default: 0 })
  roomsJoined: number;

  @Column({ default: 0 })
  tokensTransacted: number;

  @OneToMany(() => Pseudonym, (pseudonym) => pseudonym.user)
  pseudonyms: Pseudonym[];

  @OneToOne(() => Wallet, (wallet) => wallet.user)
  wallet: Wallet;

  @OneToMany(() => AuditLog, (log) => log.user)
  auditLogs: AuditLog[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
