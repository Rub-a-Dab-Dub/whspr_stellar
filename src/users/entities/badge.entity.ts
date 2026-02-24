import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { User } from '../../user/entities/user.entity';

export enum BadgeCategory {
  ACHIEVEMENT = 'achievement',
  MILESTONE = 'milestone',
  SPECIAL = 'special',
  SEASONAL = 'seasonal',
}

export enum BadgeRarity {
  COMMON = 'common',
  RARE = 'rare',
  EPIC = 'epic',
  LEGENDARY = 'legendary',
}

@Entity('badges')
export class Badge {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  name: string;

  @Column({ nullable: true })
  description: string;

  @Column({ nullable: true })
  imageUrl: string;

  @Column({ type: 'enum', enum: BadgeCategory, default: BadgeCategory.ACHIEVEMENT })
  category: BadgeCategory;

  @Column({ type: 'enum', enum: BadgeRarity, default: BadgeRarity.COMMON })
  rarity: BadgeRarity;

  @Column({ default: true })
  isActive: boolean;

  // Admin who created this badge
  @Column({ type: 'uuid', nullable: true })
  createdById?: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'createdById' })
  createdBy?: User;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  // NOTE: totalAwarded is computed at query-time by services; no DB column
}
