import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

export enum UserStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
}

export enum UserVisibility {
  PUBLIC = 'public',
  PRIVATE = 'private',
  FRIENDS = 'friends',
}

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ unique: true, length: 50 })
  @Index()
  username!: string;

  @Column({ unique: true, nullable: true })
  email!: string;

  @Column({ length: 100, nullable: true })
  displayName!: string;

  @Column({ type: 'text', nullable: true })
  bio!: string;

  @Column({ nullable: true })
  avatarCid!: string;

  @Column({ nullable: true })
  avatarUrl!: string;

  @Column({
    type: 'enum',
    enum: UserStatus,
    default: UserStatus.ACTIVE,
  })
  status!: UserStatus;

  @Column({
    type: 'enum',
    enum: UserVisibility,
    default: UserVisibility.PUBLIC,
  })
  visibility!: UserVisibility;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;

  @Column({ type: 'timestamp', nullable: true })
  lastActiveAt!: Date;
}
