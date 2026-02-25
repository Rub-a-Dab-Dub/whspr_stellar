import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { User } from '../../user/entities/user.entity';

export enum XpReason {
  SEND_MESSAGE = 'send_message',
  CREATE_ROOM = 'create_room',
  TIP_SENT = 'tip_sent',
  TIP_RECEIVED = 'tip_received',
  QUEST_COMPLETE = 'quest_complete',
  ADMIN_GRANT = 'admin_grant',
}

@Entity('xp_transactions')
@Index('IDX_XP_USER_CREATED', ['userId', 'createdAt'])
export class XpTransaction {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  /** XP awarded (always positive; deductions use negative values) */
  @Column({ type: 'int' })
  amount: number;

  @Column({ type: 'enum', enum: XpReason })
  reason: XpReason;

  /** Optional free-text context (e.g. quest name, room id) */
  @Column({ type: 'varchar', length: 255, nullable: true })
  meta: string | null;

  /** Running XP total AFTER this transaction */
  @Column({ name: 'xp_after', type: 'int' })
  xpAfter: number;

  /** Level AFTER this transaction */
  @Column({ name: 'level_after', type: 'int' })
  levelAfter: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
