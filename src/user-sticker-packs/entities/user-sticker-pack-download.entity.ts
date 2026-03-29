import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { UserStickerPack } from './user-sticker-pack.entity';

@Entity('user_sticker_pack_downloads')
@Unique('uq_user_pack_download', ['userId', 'packId'])
export class UserStickerPackDownload {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  @Index('idx_ugc_pack_dl_user')
  userId!: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user!: User;

  @Column({ type: 'uuid' })
  packId!: string;

  @ManyToOne(() => UserStickerPack, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'packId' })
  pack!: UserStickerPack;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;
}
