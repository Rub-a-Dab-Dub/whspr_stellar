import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  JoinColumn,
  Unique,
} from 'typeorm';
import { Room } from './room.entity';
import { User } from '../../user/entities/user.entity';

@Entity('room_bans')
@Unique(['roomId', 'userId'])
@Index(['roomId'])
@Index(['userId'])
@Index(['roomId', 'bannedAt'])
export class RoomBan {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid')
  roomId: string;

  @Column('uuid')
  userId: string;

  @Column('uuid')
  bannedBy: string;

  @Column({ type: 'text', nullable: true })
  reason: string;

  @Column({ type: 'timestamp', nullable: true })
  expiresAt: Date;

  @CreateDateColumn()
  bannedAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @ManyToOne(() => Room, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'roomId' })
  room: Room;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  @ManyToOne(() => User, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'bannedBy' })
  bannedByUser: User;

  get isExpired(): boolean {
    return this.expiresAt ? this.expiresAt < new Date() : false;
  }
}
