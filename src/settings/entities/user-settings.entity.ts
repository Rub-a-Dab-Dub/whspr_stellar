import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  UpdateDateColumn,
  OneToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';

export interface NotificationPreferences {
  push: {
    messages: boolean;
    mentions: boolean;
    announcements: boolean;
  };
  email: {
    marketing: boolean;
    security: boolean;
    activity: boolean;
  };
  inApp: {
    chat: boolean;
    system: boolean;
  };
}

export enum VisibilityType {
  EVERYONE = 'EVERYONE',
  CONTACTS_ONLY = 'CONTACTS_ONLY',
  NOBODY = 'NOBODY',
}

export interface PrivacySettings {
  lastSeenVisibility: VisibilityType;
  readReceiptsEnabled: boolean;
  onlineStatusVisible: boolean;
}

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

  @Column({ type: 'varchar', length: 20, default: 'dark' })
  theme!: string;

  @Column({ type: 'varchar', length: 10, default: 'en' })
  language!: string;

  @Column({ type: 'varchar', length: 50, default: 'UTC' })
  timezone!: string;

  @Column({ type: 'boolean', default: false })
  twoFactorEnabled!: boolean;

  @Column({ type: 'varchar', nullable: true, select: false }) // Hide secret by default
  twoFactorSecret!: string | null;

  @UpdateDateColumn({ type: 'timestamp' })
  updatedAt!: Date;

  @OneToOne(() => User, (user) => user.id)
  @JoinColumn({ name: 'userId' })
  user!: User;

  static createDefault(userId: string): UserSettings {
    const settings = new UserSettings();
    settings.userId = userId;
    settings.theme = 'dark';
    settings.language = 'en';
    settings.timezone = 'UTC';
    settings.twoFactorEnabled = false;
    settings.twoFactorSecret = null;
    
    settings.notificationPreferences = {
      push: { messages: true, mentions: true, announcements: false },
      email: { marketing: false, security: true, activity: true },
      inApp: { chat: true, system: true },
    };
    
    settings.privacySettings = {
      lastSeenVisibility: VisibilityType.EVERYONE,
      readReceiptsEnabled: true,
      onlineStatusVisible: true,
    };
    
    return settings;
  }
}
