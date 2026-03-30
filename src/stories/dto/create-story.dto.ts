import {
  IsEnum,
  IsOptional,
  IsString,
  IsUrl,
  Length,
  Max,
  Min,
  ValidateIf,
} from 'class-validator';
import { ContentType } from '../entities/story.entity';

const MS_24H = 24 * 60 * 60 * 1000;

export class CreateStoryDto {
  @IsEnum(ContentType)
  contentType!: ContentType;

  @ValidateIf((o: CreateStoryDto) => o.contentType === ContentType.TEXT)
  @IsString()
  @Length(1, 500)
  content?: string;

  @ValidateIf(
    (o: CreateStoryDto) => o.contentType === ContentType.IMAGE || o.contentType === ContentType.VIDEO,
  )
  @IsUrl({}, { message: 'Invalid media URL' })
  mediaUrl?: string;

  @IsOptional()
  @IsString()
  @Length(7, 7)
  backgroundColor?: string;

  @IsOptional()
  @Min(1 * 60 * 60 * 1000)
  @Max(MS_24H)
  durationMs?: number;
}
