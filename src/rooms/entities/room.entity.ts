import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';

@Entity('rooms')
export class Room {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column('uuid')
  creatorId: string;

  @Column({ type: 'bigint', nullable: true })
  @Index() // Index for efficient expiry queries
  expiryTimestamp: number | null;

  @Column({ type: 'int', nullable: true })
  durationMinutes: number | null;

  @Column({ default: false })
  isExpired: boolean;

  @Column({ default: false })
  warningNotificationSent: boolean;

  @Column({ type: 'int', default: 0 })
  extensionCount: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}