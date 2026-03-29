import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { PlatformInvite } from './platform-invite.entity';

@Entity('platform_invite_redemptions')
@Index('idx_invite_redemptions_invite', ['inviteId'])
@Index('idx_invite_redemptions_user', ['userId'])
export class PlatformInviteRedemption {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  inviteId!: string;

  @ManyToOne(() => PlatformInvite, (i) => i.redemptions, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'inviteId' })
  invite!: PlatformInvite;

  @Column({ type: 'uuid' })
  userId!: string;

  @CreateDateColumn({ type: 'timestamp' })
  redeemedAt!: Date;
}
