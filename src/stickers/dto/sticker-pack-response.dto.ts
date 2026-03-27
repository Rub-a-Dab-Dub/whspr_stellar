import { StickerResponseDto } from './sticker-response.dto';

export class StickerPackResponseDto {
  id!: string;
  name!: string;
  author!: string | null;
  isOfficial!: boolean;
  coverUrl!: string | null;
  stickerCount!: number;
  createdAt!: Date;
  stickers?: StickerResponseDto[];
}
