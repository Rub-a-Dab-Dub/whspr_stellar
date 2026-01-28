import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Achievement } from './entities/achievement.entity';
import { UserAchievement } from './entities/user-achievement.entity';
import { AchievementService } from './services/achievement.service';
import { AchievementCheckerService } from './services/achievement-checker.service';
import { AchievementNotificationService } from './services/achievement-notification.service';
import {
  AchievementController,
  UserAchievementController,
} from './controllers/achievement.controller';
import { AchievementSeeder } from './seeders/achievement.seeder';

@Module({
  imports: [TypeOrmModule.forFeature([Achievement, UserAchievement])],
  controllers: [AchievementController, UserAchievementController],
  providers: [
    AchievementService,
    AchievementCheckerService,
    AchievementNotificationService,
    AchievementSeeder,
  ],
  exports: [
    AchievementService,
    AchievementCheckerService,
    AchievementNotificationService,
    AchievementSeeder,
  ],
})
export class AchievementsModule {}
