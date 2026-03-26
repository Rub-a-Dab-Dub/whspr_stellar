import { Column, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

export type NotificationChannelPreference = {
  push: boolean;
  email: boolean;
  inApp: boolean;
};

export type NotificationPreferences = {
  messages: NotificationChannelPreference;
  mentions: NotificationChannelPreference;
  system: NotificationChannelPreference;
};

export type PrivacySettings = {
  lastSeenVisibility: 'everyone' | 'contacts' | 'nobody';
  readReceiptsEnabled: boolean;
  onlineStatusVisible: boolean;
};

@Entity('user_settings')
export class UserSettings {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', unique: true })
  @Index('idx_user_settings_user_id')
  userId!: string;

  @Column({ type: 'jsonb' })
  notificationPreferences!: NotificationPreferences;

  @Column({ type: 'jsonb' })
  privacySettings!: PrivacySettings;

  @Column({ type: 'varchar', length: 20, default: 'system' })
  theme!: string;

  @Column({ type: 'varchar', length: 10, default: 'en' })
  language!: string;

  @Column({ type: 'varchar', length: 60, default: 'UTC' })
  timezone!: string;

  @Column({ type: 'boolean', default: false })
  twoFactorEnabled!: boolean;

  @Column({ type: 'varchar', length: 128, nullable: true })
  twoFactorSecret!: string | null;

  @UpdateDateColumn({ type: 'timestamp' })
  updatedAt!: Date;
}
