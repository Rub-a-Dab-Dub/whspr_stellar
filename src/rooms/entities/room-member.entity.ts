import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  Index,
} from 'typeorm';

export enum RoomMemberRole {
  MEMBER = 'MEMBER',
  MODERATOR = 'MODERATOR',
}

@Entity('room_members')
@Index(['roomId', 'userId'], { unique: true })
export class RoomMember {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne('Room', { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'room_id' })
  room: unknown;

  @Column({ name: 'room_id' })
  roomId: string;

  @ManyToOne('User', { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: unknown;

  @Column({ name: 'user_id' })
  userId: string;

  @Column({ name: 'transaction_hash', nullable: true, unique: true })
  transactionHash: string;

  @Column('decimal', { precision: 18, scale: 8, nullable: true })
  paidAmount: string;

  @Column({
    type: 'enum',
    enum: RoomMemberRole,
    default: RoomMemberRole.MEMBER,
  })
  role: RoomMemberRole;

  @Column({ name: 'is_banned', default: false })
  isBanned: boolean;

  @CreateDateColumn({ name: 'joined_at' })
  joinedAt: Date;
}
