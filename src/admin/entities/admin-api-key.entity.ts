import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  Index,
} from 'typeorm';
import { User } from '../../user/entities/user.entity';

@Entity('admin_api_keys')
@Index(['keyHash'], { unique: true })
export class AdminApiKey {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column({ length: 64 })
  keyHash: string;

  @Column({ length: 16 })
  keyPrefix: string;

  @Column('text', { array: true })
  permissions: string[];

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  admin: User; // 👈 the relation is a User, just named "admin"

  @Column({ type: 'timestamp', nullable: true })
  lastUsedAt: Date | null;

  @Column({ type: 'timestamp', nullable: true })
  expiresAt: Date | null;

  @Column({ default: true })
  isActive: boolean;

  @CreateDateColumn()
  createdAt: Date;
}
