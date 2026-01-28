import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('moderation_warnings')
export class ModerationWarning {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  userId: string;

  @Column()
  roomId: string;

  @Column()
  reason: string;

  @Column({ default: 1 })
  count: number;

  @Column({ type: 'timestamp', nullable: true })
  lastWarningAt: Date;

  @CreateDateColumn()
  createdAt: Date;
}