import { ContentType } from '../entities/story.entity';

export class StoryViewDto {
  viewerId!: string;
  viewedAt!: Date;
}

export class StoryResponseDto {
  id!: string;
  userId!: string;
  username!: string;
  avatarUrl!: string | null;
  contentType!: ContentType;
  content!: string | null;
  mediaUrl!: string | null;
  backgroundColor!: string | null;
  duration!: number;
  viewCount!: number;
  expiresAt!: Date;
  createdAt!: Date;
  myViews?: StoryViewDto[];
}
