import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { InAppNotificationType } from '../../notifications/entities/notification.entity';

@Entity('quiet_hours_configs')
export class QuietHoursConfig {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', unique: true })
  @Index('idx_quiet_hours_user')
  userId!: string;

  @Column({ type: 'boolean', default: false })
  isEnabled!: boolean;

  /**
   * 24-hour format string e.g. "22:00"
   */
  @Column({ type: 'varchar', length: 5, default: '22:00' })
  startTime!: string;

  /**
   * 24-hour format string e.g. "08:00"
   */
  @Column({ type: 'varchar', length: 5, default: '08:00' })
  endTime!: string;

  /**
   * IANA timezone identifier e.g. "America/New_York"
   */
  @Column({ type: 'varchar', length: 64, default: 'UTC' })
  timezone!: string;

  /**
   * Notification types that bypass quiet hours (always delivered immediately)
   */
  @Column({
    type: 'simple-array',
    nullable: true,
    default: `${InAppNotificationType.TRANSFER_RECEIVED},SECURITY_ALERT`,
  })
  exemptTypes!: string[];

  @CreateDateColumn({ type: 'timestamp' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamp' })
  updatedAt!: Date;
}
