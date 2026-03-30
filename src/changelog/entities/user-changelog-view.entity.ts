import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

@Entity('user_changelog_views')
@Index(['userId'])
export class UserChangelogView {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  @Index()
  userId: string;

  @Column({ nullable: true })
  lastSeenVersion: string | null;

  @UpdateDateColumn()
  updatedAt: Date;
}
