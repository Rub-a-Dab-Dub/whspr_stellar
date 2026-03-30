import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

export enum ChangelogPlatform {
  ALL = 'ALL',
  WEB = 'WEB',
  IOS = 'IOS',
  ANDROID = 'ANDROID',
}

export enum ChangelogType {
  FEATURE = 'FEATURE',
  BUGFIX = 'BUGFIX',
  SECURITY = 'SECURITY',
  BREAKING = 'BREAKING',
}

@Entity('changelogs')
@Index(['isPublished', 'publishedAt'])
@Index(['platform', 'isPublished'])
export class Changelog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  @Index()
  version: string;

  @Column({
    type: 'enum',
    enum: ChangelogPlatform,
    default: ChangelogPlatform.ALL,
  })
  platform: ChangelogPlatform;

  @Column()
  title: string;

  @Column('jsonb', { default: [] })
  highlights: string[];

  @Column('text', { nullable: true })
  fullContent: string | null;

  @Column({
    type: 'enum',
    enum: ChangelogType,
    default: ChangelogType.FEATURE,
  })
  type: ChangelogType;

  @Column({ default: false })
  isPublished: boolean;

  @Column({ nullable: true })
  publishedAt: Date | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
