import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { User } from '../../../users/entities/user.entity';

export enum SocialProvider {
  GOOGLE = 'GOOGLE',
  TWITTER = 'TWITTER',
  GITHUB = 'GITHUB',
}

@Entity('social_accounts')
// Ensure one provider per user, and providerId is unique globally
@Index(['provider', 'providerId'], { unique: true })
export class SocialAccount {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  userId!: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user!: User;

  @Column({ type: 'enum', enum: SocialProvider })
  provider!: SocialProvider;

  @Column({ type: 'varchar', length: 255 })
  providerId!: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  email!: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  displayName!: string | null;

  @Column({ type: 'text', nullable: true })
  avatarUrl!: string | null;

  @Column({ type: 'text' })
  accessToken!: string; // Encrypted

  @Column({ type: 'text', nullable: true })
  refreshToken!: string | null; // Encrypted

  @CreateDateColumn({ type: 'timestamp' })
  linkedAt!: Date;

  @UpdateDateColumn({ type: 'timestamp' })
  updatedAt!: Date;
}
