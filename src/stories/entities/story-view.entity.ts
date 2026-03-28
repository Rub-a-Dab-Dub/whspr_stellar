import {
  Entity,
  PrimaryColumn,
  CreateDateColumn,
  Column,
} from 'typeorm';

@Entity('story_views')
export class StoryView {
  @PrimaryColumn()
  storyId!: string;

  @PrimaryColumn()
  viewerId!: string;

  @CreateDateColumn()
  viewedAt!: Date;

  @Column({ default: false })
  isCreatorView!: boolean; // if viewer is story creator
}

