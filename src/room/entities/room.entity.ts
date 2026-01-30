import { User } from '../../user/entities/user.entity';
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  OneToMany,
  CreateDateColumn,
  UpdateDateColumn,
  JoinColumn,
} from 'typeorm';
import { RoomPayment } from './room-payment.entity';
import { RoomMember } from './room-member.entity';
import { RoomInvitation } from './room-invitation.entity';
import { ROOM_MEMBER_CONSTANTS } from '../constants/room-member.constants';

export enum RoomType {
  PUBLIC = 'PUBLIC',
  PRIVATE = 'PRIVATE',
  TOKEN_GATED = 'TOKEN_GATED',
  TIMED = 'TIMED',
}

@Entity('rooms')
export class Room {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column()
  name!: string;

  @Column({ type: 'text', nullable: true })
  description?: string;

  @Column({ type: 'uuid', nullable: true })
  ownerId?: string;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'ownerId' })
  owner?: User;

  @Column({ type: 'uuid', nullable: true })
  creatorId?: string;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'creatorId' })
  creator?: User;

  @Column({
    type: 'enum',
    enum: RoomType,
    default: RoomType.PUBLIC,
  })
  roomType!: RoomType;

  @Column({ default: false })
  isPrivate!: boolean;

  @Column({ type: 'varchar', nullable: true })
  icon?: string;

  @Column({ type: 'int', default: ROOM_MEMBER_CONSTANTS.DEFAULT_MAX_MEMBERS })
  maxMembers!: number;

  @Column({ default: true })
  isActive!: boolean;

  @Column({ default: 0 })
  memberCount!: number;

  @Column({ name: 'is_token_gated', default: false })
  isTokenGated!: boolean;

  @Column('decimal', { precision: 18, scale: 8, name: 'entry_fee', default: 0 })
  entryFee!: string;

  @Column({ name: 'token_address', nullable: true })
  tokenAddress?: string;

  @Column({ name: 'payment_required', default: false })
  paymentRequired!: boolean;

  @Column({ name: 'free_trial_enabled', default: false })
  freeTrialEnabled!: boolean;

  @Column({ name: 'free_trial_duration_hours', default: 24 })
  freeTrialDurationHours!: number;

  @Column({ name: 'access_duration_days', nullable: true })
  accessDurationDays?: number;

  @Column({ type: 'bigint', nullable: true })
  expiryTimestamp?: number | null;

  @Column({ type: 'int', nullable: true })
  durationMinutes?: number | null;

  @Column({ default: false })
  isExpired!: boolean;

  @Column({ default: false })
  warningNotificationSent!: boolean;

  @Column({ type: 'int', default: 0 })
  extensionCount!: number;

  @Column({ default: false })
  isDeleted!: boolean;

  @Column({ type: 'timestamp', nullable: true })
  deletedAt?: Date;

  @OneToMany(() => RoomPayment, payment => payment.room)
  payments!: RoomPayment[];

  @OneToMany(() => RoomMember, (member) => member.room)
  members!: RoomMember[];

  @OneToMany(() => RoomInvitation, (invitation) => invitation.room)
  invitations: RoomInvitation[];

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
