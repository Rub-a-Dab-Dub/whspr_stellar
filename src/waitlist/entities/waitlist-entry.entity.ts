import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

@Entity('waitlist_entries')
export class WaitlistEntry {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index({ unique: true })
  @Column({ unique: true })
  email: string;

  @Index({ unique: true })
  @Column({ unique: true, length: 12 })
  referralCode: string;

  @Column({ nullable: true, length: 12 })
  referredBy: string; // referralCode of whoever referred this person

  @Column({ default: 10 })
  points: number;

  @Column({ default: 0 })
  position: number;

  @Column({ default: false })
  isConverted: boolean;

  @Column({ nullable: true })
  ipAddress: string;

  @Column({ default: 1 })
  referralDepth: number; // tracks depth in referral chain, max 3

  @CreateDateColumn()
  joinedAt: Date;
}