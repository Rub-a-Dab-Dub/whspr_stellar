import { IsString, IsArray, IsOptional, IsUUID } from 'class-validator';

export class CreateStickerDto {
  @IsUUID()
  packId!: string;

  @IsString()
  name!: string;

  @IsString()
  fileUrl!: string;

  @IsString()
  @IsOptional()
  thumbnailUrl?: string;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  tags?: string[];
}
