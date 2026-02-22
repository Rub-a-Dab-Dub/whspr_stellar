import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  ManyToMany,
  JoinTable,
  Index,
} from 'typeorm';
import { Exclude } from 'class-transformer';
import { Role } from '../../roles/entities/role.entity';
import { UserRole } from '../../roles/entities/user-role.enum';
import { UserProfile } from './user-profile.entity';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string | undefined;

  @Column({
    type: 'enum',
    enum: UserRole,
    default: UserRole.USER,
  })
  @Index()
  role: UserRole = UserRole.USER;

  @Column({ unique: true, nullable: true })
  @Index()
  username: string | undefined;

  @Column({ unique: true, nullable: true })
  @Index()
  email: string | undefined;

  @Column({ unique: true, nullable: true })
  @Index()
  walletAddress: string | undefined;

  @Column({ nullable: true })
  @Exclude()
  password: string | undefined;

  @Column(() => UserProfile)
  profile: UserProfile | undefined;

  @Column({ default: false })
  isEmailVerified: boolean = false;

  @Column({ nullable: true })
  @Exclude()
  emailVerificationToken: string | undefined;

  @Column({ nullable: true })
  @Exclude()
  emailVerificationExpires: Date | undefined;

  @Column({ nullable: true })
  @Exclude()
  passwordResetToken: string | undefined;

  @Column({ nullable: true })
  @Exclude()
  passwordResetExpires: Date | undefined;

  // Stats
  @Column({ default: 0 })
  @Index()
  currentXp: number = 0;

  @Column({ default: 1 })
  level: number = 1;

  @Column({ default: 0 })
  totalTips: number = 0;

  // Security & Moderation
  @Column({ default: 0 })
  @Exclude()
  loginAttempts: number = 0;

  @Column({ nullable: true })
  @Exclude()
  lockoutUntil: Date | undefined;

  @Column({ nullable: true })
  @Exclude()
  refreshToken: string | undefined;

  @Column({ default: false })
  isBanned: boolean = false;

  @Column({ type: 'timestamp', nullable: true })
  bannedAt: Date | undefined;

  @Column({ type: 'uuid', nullable: true })
  bannedBy: string | undefined;

  @Column({ type: 'text', nullable: true })
  banReason: string | undefined;

  @Column({ type: 'timestamp', nullable: true })
  banExpiresAt: Date | undefined;

  @Column({ type: 'timestamp', nullable: true })
  suspendedAt: Date | undefined;

  @Column({ type: 'uuid', nullable: true })
  suspendedBy: string | undefined;

  @Column({ type: 'text', nullable: true })
  suspensionReason: string | undefined;

  @Column({ type: 'timestamp', nullable: true })
  suspendedUntil: Date | undefined;

  @Column({ type: 'timestamp', nullable: true })
  suspendedAt: Date | null;

  @Column({ type: 'uuid', nullable: true })
  suspendedBy: string | null;

  @Column({ type: 'text', nullable: true })
  suspensionReason: string | null;

  @Column({ default: false })
  isVerified: boolean;

  @Column({ type: 'timestamp', nullable: true })
  verifiedAt: Date | null;

  @Column({ type: 'uuid', nullable: true })
  verifiedBy: string | null;

  // Timestamps
  @CreateDateColumn()
  createdAt: Date | undefined;

  @UpdateDateColumn()
  updatedAt: Date | undefined;

  @DeleteDateColumn()
  deletedAt: Date | undefined;

  // Relations
  @ManyToMany(() => Role, (role) => role.users, {
    eager: true,
    cascade: true,
  })
  @JoinTable({
    name: 'user_roles',
    joinColumn: { name: 'user_id', referencedColumnName: 'id' },
    inverseJoinColumn: { name: 'role_id', referencedColumnName: 'id' },
  })
  roles: Role[] | undefined;

  // Helpers
  get isLocked(): boolean {
    return !!(this.lockoutUntil && this.lockoutUntil > new Date());
  }

  get isSuspended(): boolean {
    return !!(this.suspendedUntil && this.suspendedUntil > new Date());
  }
}
