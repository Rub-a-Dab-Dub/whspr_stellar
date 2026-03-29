import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { UserStickerPack } from './user-sticker-pack.entity';

@Entity('user_stickers_ugc')
@Index('idx_user_stickers_ugc_pack', ['packId'])
export class UserSticker {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  packId!: string;

  @ManyToOne(() => UserStickerPack, (p) => p.stickers, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'packId' })
  pack!: UserStickerPack;

  @Column({ type: 'varchar', length: 100 })
  name!: string;

  @Column({ type: 'text' })
  fileKey!: string;

  @Column({ type: 'text' })
  fileUrl!: string;

  @Column({
    type: 'simple-array',
    default: '',
  })
  tags!: string[];

  @Column({ name: 'sort_order', type: 'int', default: 0 })
  sortOrder!: number;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;
}
