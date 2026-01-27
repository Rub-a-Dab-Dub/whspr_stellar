import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

@Entity('blocked_users')
@Index(['blockerId', 'blockedUserId'], { unique: true })
export class BlockedUser {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid')
  @Index()
  blockerId: string;

  @Column('uuid')
  @Index()
  blockedUserId: string;

  @Column({ nullable: true })
  reason: string;

  @CreateDateColumn()
  blockedAt: Date;
}
