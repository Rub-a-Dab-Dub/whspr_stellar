import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

@Entity('user_blocks')
@Index(['blockerId', 'blockedId'], { unique: true })
@Index(['blockedId'])
export class UserBlock {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'blocker_id' })
  blockerId: string;

  @Column({ name: 'blocked_id' })
  blockedId: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}