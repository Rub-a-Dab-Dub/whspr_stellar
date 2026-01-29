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

export enum MemberRole {
  OWNER = 'OWNER',
  ADMIN = 'ADMIN',
  MODERATOR = 'MODERATOR',
  MEMBER = 'MEMBER',
}

export enum MemberStatus {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
  SUSPENDED = 'SUSPENDED',
  REMOVED = 'REMOVED',
}

@Entity('room_members')
@Unique(['roomId', 'userId'])
@Index(['roomId'])
@Index(['userId'])
@Index(['roomId', 'role'])
export class RoomMember {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid')
  roomId: string;

  @Column('uuid')
  userId: string;

  @Column({
    type: 'enum',
    enum: MemberRole,
    default: MemberRole.MEMBER,
  })
  role: MemberRole;

  @Column({
    type: 'enum',
    enum: MemberStatus,
    default: MemberStatus.ACTIVE,
  })
  status: MemberStatus;

  @Column('simple-array', { nullable: true })
  permissions: string[];

  @Column({ nullable: true })
  inviteToken: string;

  @Column({
    type: 'varchar',
    default: 'ACCEPTED',
  })
  inviteStatus: 'PENDING' | 'ACCEPTED' | 'REJECTED';

  @CreateDateColumn()
  joinedAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @Column({ nullable: true })
  lastActivityAt: Date;

  @Column({ type: 'text', nullable: true })
  kickReason: string;

  @Column({ nullable: true })
  kickedAt: Date;

  @Column({ nullable: true })
  kickedBy: string;

  @CreateDateColumn()
  createdAt: Date;

  @ManyToOne(() => Room, (room) => room.members, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'roomId' })
  room: Room;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;
}
