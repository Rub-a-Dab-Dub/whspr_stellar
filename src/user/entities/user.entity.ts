// src/users/entities/user.entity.ts
import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToMany,
  JoinTable,
} from 'typeorm';
import { Exclude } from 'class-transformer';
import { Role } from '../../roles/entities/role.entity';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string | undefined;

  @Column({ unique: true })
  email!: string;

  @Column()
  @Exclude()
  password!: string;

  @Column({ default: false })
  isEmailVerified!: boolean;

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

  @Column({ default: 0 })
  @Exclude()
  loginAttempts: number | undefined;

  @Column({ nullable: true })
  @Exclude()
  lockoutUntil: Date | undefined;

  @Column({ nullable: true })
  @Exclude()
  refreshToken: string | undefined;

  @Column({ default: false })
  isBanned!: boolean;

  @Column({ type: 'timestamp', nullable: true })
  bannedAt: Date | undefined;

  @Column({ type: 'uuid', nullable: true })
  bannedBy: string | undefined;

  @Column({ type: 'text', nullable: true })
  banReason: string | undefined;

  @Column({ type: 'timestamp', nullable: true })
  suspendedUntil: Date | undefined;

  @Column({ type: 'timestamp', nullable: true })
  suspendedAt: Date | undefined;

  @Column({ type: 'uuid', nullable: true })
  suspendedBy: string | undefined;

  @Column({ type: 'text', nullable: true })
  suspensionReason: string | undefined;

  @Column({ default: false })
  isVerified!: boolean;

  @Column({ type: 'timestamp', nullable: true })
  verifiedAt: Date | undefined;

  @Column({ type: 'uuid', nullable: true })
  verifiedBy: string | undefined;

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

  @CreateDateColumn()
  createdAt: Date | undefined;

  @UpdateDateColumn()
  updatedAt: Date | undefined;

  get isLocked(): boolean {
    return !!(this.lockoutUntil && this.lockoutUntil > new Date());
  }

  get isSuspended(): boolean {
    return !!(
      this.suspendedUntil && this.suspendedUntil > new Date()
    );
  }
}
