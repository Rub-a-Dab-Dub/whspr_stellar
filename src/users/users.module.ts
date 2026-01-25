import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { User } from './entities/user.entity';
import { PinataService } from './services/pinata.service';
import { XpHistory } from './entities/xp-history.entity';
import { XpService } from './services/xp.service';
import { Streak } from './entities/streak.entity';
import { StreakReward } from './entities/streak-reward.entity';
import { StreakBadge } from './entities/streak-badge.entity';
import { StreakHistory } from './entities/streak-history.entity';
import { StreakService } from './services/streak.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      User,
      XpHistory,
      Streak,
      StreakReward,
      StreakBadge,
      StreakHistory,
    ]),
  ],
  controllers: [UsersController],
  providers: [UsersService, PinataService, XpService, StreakService],
  exports: [UsersService, XpService, StreakService],
})
export class UsersModule {}
