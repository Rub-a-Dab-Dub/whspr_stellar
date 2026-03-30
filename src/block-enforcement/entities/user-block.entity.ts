import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Unique, Index } from 'typeorm';

@Entity('user_blocks')
@Unique(['blockerId', 'blockedId'])
@Index(['blockerId'])
@Index(['blockedId'])
export class UserBlock {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  blockerId!: string;

  @Column({ type: 'uuid' })
  blockedId!: string;

  @CreateDateColumn({ type: 'timestamp' })
  createdAt!: Date;
}
