import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, CreateDateColumn, UpdateDateColumn, JoinColumn, Index } from 'typeorm';
import { Room } from './room.entity';
import { User } from '../../users/entities/user.entity';

@Entity('user_room_access')
@Index(['userId', 'roomId'], { unique: true })
export class UserRoomAccess {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ name: 'user_id' })
  userId: string;

  @ManyToOne(() => Room, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'room_id' })
  room: Room;

  @Column({ name: 'room_id' })
  roomId: string;

  @Column({ name: 'has_access', default: false })
  hasAccess: boolean;

  @Column({ name: 'is_free_trial', default: false })
  isFreeTrial: boolean;

  @Column({ name: 'access_expires_at', type: 'timestamp', nullable: true })
  accessExpiresAt: Date;

  @Column({ name: 'payment_id', nullable: true })
  paymentId: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
