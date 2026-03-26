import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  OneToMany,
  Index,
} from 'typeorm';
import { Sticker } from './sticker.entity';

@Entity('sticker_packs')
export class StickerPack {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 100 })
  @Index('idx_sticker_packs_name')
  name!: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  author!: string | null;

  @Column({ type: 'boolean', default: false })
  @Index('idx_sticker_packs_is_official')
  isOfficial!: boolean;

  @Column({ type: 'text', nullable: true })
  coverUrl!: string | null;

  @Column({ type: 'int', default: 0 })
  stickerCount!: number;

  @OneToMany(() => Sticker, (sticker) => sticker.pack, {
    cascade: true,
    eager: false,
  })
  stickers!: Sticker[];

  @CreateDateColumn({ type: 'timestamp' })
  createdAt!: Date;
}
