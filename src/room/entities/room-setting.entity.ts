import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Room } from './room.entity';

export enum MessagePermission {
  ALL = 'all',
  ADMIN = 'admin',
  OWNER = 'owner',
}

@Entity('room_settings')
export class RoomSettings {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ManyToOne(() => Room, { onDelete: 'CASCADE' })
  room!: Room;

  @Column({ type: 'varchar', default: MessagePermission.ALL })
  messagePermission!: MessagePermission;

  @Column({ default: false })
  readOnly!: boolean;

  @Column({ default: 0 }) // seconds between messages, 0 = disabled
  slowModeSeconds!: number;

  @Column({ default: true })
  allowLinks!: boolean;

  @Column({ default: true })
  allowMedia!: boolean;

  @Column({ default: true })
  notificationsEnabled!: boolean;

  @Column({ type: 'varchar', nullable: true })
  themeColor!: string;

  @Column({ type: 'varchar', nullable: true })
  roomIcon!: string;

  @Column({ type: 'text', nullable: true })
  welcomeMessage!: string;

  @Column({ type: 'text', nullable: true })
  roomDescription!: string;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
