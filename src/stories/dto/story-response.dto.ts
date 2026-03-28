import { Exclude, Expose, Type } from 'class-transformer';
import { ContentType } from '../entities/story.entity';

export class StoryViewDto {
  viewerId!: string;
  viewedAt!: Date;
}

export class StoryResponseDto {
  id!: string;
  userId!: string;
  username!: string; // populated
  avatarUrl!: string | null;
  contentType!: ContentType;
  content!: string | null;
  mediaUrl!: string | null;
  backgroundColor!: string | null;
  viewCount!: number;
  expiresAt!: Date;
  createdAt!: Date;
  myViews?: StoryViewDto[]; // only for owner
}

