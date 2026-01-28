import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from 'typeorm';
import { UserAchievement } from './user-achievement.entity';

export enum AchievementType {
  FIRST_MESSAGE = 'first_message',
  MESSAGES_100 = '100_messages',
  MESSAGES_500 = '500_messages',
  MESSAGES_1000 = '1000_messages',
  ROOM_CREATOR = 'room_creator',
  ROOMS_10 = '10_rooms',
  EARLY_ADOPTER = 'early_adopter',
  NIGHT_OWL = 'night_owl',
  SOCIAL_BUTTERFLY = 'social_butterfly',
  CONVERSATION_STARTER = 'conversation_starter',
  VETERAN = 'veteran',
  LEGEND = 'legend',
}

export enum AchievementRarity {
  COMMON = 'common',
  UNCOMMON = 'uncommon',
  RARE = 'rare',
  EPIC = 'epic',
  LEGENDARY = 'legendary',
}

@Entity('achievements')
export class Achievement {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  name: string;

  @Column('text')
  description: string;

  @Column({
    type: 'enum',
    enum: AchievementType,
    unique: true,
  })
  type: AchievementType;

  @Column('jsonb')
  criteria: {
    type: string;
    target?: number;
    condition?: string;
    [key: string]: any;
  };

  @Column({ nullable: true })
  icon: string;

  @Column({
    type: 'enum',
    enum: AchievementRarity,
    default: AchievementRarity.COMMON,
  })
  rarity: AchievementRarity;

  @Column({ type: 'int', default: 0 })
  xpBonus: number;

  @Column({ default: true })
  isActive: boolean;

  @Column({ default: false })
  isHidden: boolean;

  @Column({ type: 'int', default: 0 })
  displayOrder: number;

  @OneToMany(
    () => UserAchievement,
    (userAchievement) => userAchievement.achievement,
  )
  userAchievements: UserAchievement[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
