import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  DeleteDateColumn,
} from 'typeorm';

export enum UserRole {
  USER = 'user',
  ROOM_CREATOR = 'room_creator',
  MODERATOR = 'moderator',
  ADMIN = 'admin',
}

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index({ unique: true })
  @Column({ name: 'wallet_address', type: 'varchar', length: 42 })
  walletAddress: string;

  @Column({
    type: 'enum',
    enum: UserRole,
    default: UserRole.USER,
  })
  role: UserRole;

  @Column({ default: true })
  isActive: boolean;

  @Column({ unique: true, nullable: true })
  @Index()
  username: string | null;

  @Column({ unique: true, nullable: true })
  @Index()
  email: string | null;

  @Column({ nullable: true })
  avatarUrl: string | null;

  @Column({ nullable: true })
  avatarIpfsHash: string | null;

  @Column({ default: false })
  isOnline: boolean;

  @Column({ default: false })
  isBanned: boolean;

  @Column({ type: 'timestamp', nullable: true })
  suspendedUntil: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @DeleteDateColumn()
  deletedAt: Date | null;

  // ── XP / Gamification ─────────────────────────────────────────────────────

  @Column({ name: 'xp_total', type: 'int', default: 0 })
  xpTotal: number;

  @Column({ name: 'level', type: 'int', default: 1 })
  level: number;
}
