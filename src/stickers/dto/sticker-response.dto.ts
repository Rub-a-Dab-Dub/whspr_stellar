export class StickerResponseDto {
  id!: string;
  packId!: string;
  name!: string;
  fileUrl!: string;
  thumbnailUrl!: string | null;
  tags!: string[];
  createdAt!: Date;
}
