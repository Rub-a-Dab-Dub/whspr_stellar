import { IsString, IsOptional, IsBoolean } from 'class-validator';

export class CreateStickerPackDto {
  @IsString()
  name!: string;

  @IsString()
  @IsOptional()
  author?: string;

  @IsBoolean()
  @IsOptional()
  isOfficial?: boolean;

  @IsString()
  @IsOptional()
  coverUrl?: string;
}
