import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { UserSticker } from './user-sticker.entity';

@Entity('user_sticker_packs')
@Index('idx_user_sticker_packs_creator', ['creatorId'])
@Index('idx_user_sticker_packs_public', ['isPublished', 'isApproved'])
export class UserStickerPack {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  creatorId!: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'creatorId' })
  creator!: User;

  @Column({ type: 'varchar', length: 120 })
  name!: string;

  @Column({ type: 'text', nullable: true })
  description!: string | null;

  @Column({ type: 'text', nullable: true })
  coverUrl!: string | null;

  @Column({ type: 'boolean', default: false })
  isPublished!: boolean;

  @Column({ type: 'boolean', default: false })
  isApproved!: boolean;

  @Column({ type: 'int', default: 0 })
  downloadCount!: number;

  /** 0 = free (stored as decimal string for precision). */
  @Column({ type: 'decimal', precision: 10, scale: 2, default: '0' })
  price!: string;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;

  @OneToMany(() => UserSticker, (s) => s.pack, { cascade: true })
  stickers!: UserSticker[];
}
