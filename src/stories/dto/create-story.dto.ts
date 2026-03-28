import { IsEnum, IsOptional, IsString, IsUrl, Length, Max, Min } from 'class-validator';
import { ContentType } from '../entities/story.entity';

export class CreateStoryDto {
  @IsEnum(ContentType)
  contentType!: ContentType;

  @IsOptional()
  @IsString()
  @Length(1, 500)
  content?: string; // for TEXT

  @IsOptional()
  @IsUrl({}, { message: 'Invalid media URL' })
  mediaUrl?: string;

  @IsOptional()
  @IsString()
  @Length(7, 7) // #RRGGBB
  backgroundColor?: string;

  @IsOptional()
  @Min(1 * 60 * 60 * 1000) // 1h min
  @Max(48 * 60 * 60 * 1000) // 48h max
  durationMs?: number; // override default 24h
}

