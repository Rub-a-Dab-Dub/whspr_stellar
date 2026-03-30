import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  ManyToOne,
  JoinColumn,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';

@Entity('custom_emojis')
@Index('idx_custom_emojis_group_id', ['groupId'])
@Index('idx_custom_emojis_group_name', ['groupId', 'name'], { unique: true })
@Index('idx_custom_emojis_is_active', ['isActive'])
export class CustomEmoji {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  groupId!: string;

  @Column({ type: 'uuid' })
  uploadedBy!: string;

  @Column({ type: 'varchar', length: 32 })
  name!: string;

  @Column({ type: 'text' })
  imageUrl!: string;

  @Column({ type: 'varchar', length: 512 })
  fileKey!: string;

  @Column({ type: 'int', default: 0 })
  usageCount!: number;

  @Column({ type: 'boolean', default: true })
  isActive!: boolean;

  @ManyToOne(() => User, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'uploadedBy' })
  uploader!: User | null;

  @CreateDateColumn({ type: 'timestamp' })
  createdAt!: Date;
}
