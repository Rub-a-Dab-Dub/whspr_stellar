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
  walletAddress: string; // EVM checksummed address

  @Column({
    type: 'enum',
    enum: UserRole,
    default: UserRole.USER,
  })
  role: UserRole;

  @Column({ default: true })
  isActive: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
  @Column({ unique: true, nullable: true })
  @Index()
  username: string | null;

  @Column({ unique: true, nullable: true })
  @Index()
  email: string | null;

  // @Column({ unique: true, nullable: true })
  // @Index()
  // walletAddress: string | null;

  @Column({ default: false })
  isBanned: boolean;

  @Column({ type: 'timestamp', nullable: true })
  suspendedUntil: Date | null;

  // @CreateDateColumn()
  // createdAt: Date;

  // @UpdateDateColumn()
  // updatedAt: Date;

  @DeleteDateColumn()
  deletedAt: Date | null;
}
