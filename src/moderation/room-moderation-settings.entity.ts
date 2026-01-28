import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('room_moderation_settings')
export class RoomModerationSettings {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  roomId: string;

  @Column({ default: true })
  profanityFilterEnabled: boolean;

  @Column({ default: true })
  spamDetectionEnabled: boolean;

  @Column({ default: true })
  linkSpamDetectionEnabled: boolean;

  @Column({ type: 'jsonb', default: [] })
  whitelistedWords: string[];

  @Column({ type: 'jsonb', default: [] })
  blacklistedWords: string[];

  @Column({ type: 'jsonb', default: [] })
  whitelistedDomains: string[];

  @Column({ default: 5 })
  maxMessagesPerMinute: number;

  @Column({ default: 3 })
  maxWarningsBeforeMute: number;

  @Column({ default: 60 })
  autoMuteDuration: number; // in minutes

  @Column({ default: 0.7 })
  spamThreshold: number; // 0-1

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}