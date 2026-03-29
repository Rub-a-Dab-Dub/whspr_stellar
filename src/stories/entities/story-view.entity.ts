import { Entity, PrimaryColumn, CreateDateColumn } from 'typeorm';

@Entity('story_views')
export class StoryView {
  @PrimaryColumn('uuid')
  storyId!: string;

  @PrimaryColumn('uuid')
  viewerId!: string;

  @CreateDateColumn({ type: 'timestamptz' })
  viewedAt!: Date;
}
