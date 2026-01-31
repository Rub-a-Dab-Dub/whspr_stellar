import { Column } from 'typeorm';

export class UserProfile {
  @Column({ type: 'text', nullable: true })
  bio: string | undefined;

  @Column({ nullable: true })
  avatarUrl: string | undefined;

  @Column({ nullable: true })
  website: string | undefined;

  @Column({ nullable: true })
  location: string | undefined;
}
