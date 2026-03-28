import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { StickerPack } from './sticker-pack.entity';

@Entity('stickers')
export class Sticker {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  @Index('idx_stickers_pack_id')
  packId!: string;

  @Column({ type: 'varchar', length: 100 })
  name!: string;

  @Column({ type: 'text' })
  fileUrl!: string;

  @Column({ type: 'text', nullable: true })
  thumbnailUrl!: string | null;

  @Column({
    type: 'simple-array',
    default: '',
  })
  tags!: string[];

  @ManyToOne(() => StickerPack, (pack) => pack.stickers, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'packId' })
  pack!: StickerPack;

  @CreateDateColumn({ type: 'timestamp' })
  createdAt!: Date;
}
