import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  Index,
  Unique,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { MuteType } from '../enums/mute-type.enum';

@Entity('user_mutes')
@Unique(['userId', 'targetType', 'targetId'])
@Index(['userId', 'targetType'])
@Index(['expiresAt'])
export class UserMute {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column()
  userId!: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  user!: User;

  @Column({
    type: 'enum',
    enum: MuteType,
  })
  targetType!: MuteType;

  @Column()
  targetId!: string;

  @Column({ type: 'timestamp', nullable: true })
  expiresAt!: Date | null;

  @Column({ type: 'text', nullable: true })
  reason!: string | null;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}