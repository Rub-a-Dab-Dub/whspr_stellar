import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Badge } from './entities/badge.entity';
import { UserBadge } from './entities/user-badge.entity';
import { BadgeRepository } from './badge.repository';
import { UserBadgeRepository } from './user-badge.repository';
import { BadgesService } from './badges.service';
import { BadgesController } from './badges.controller';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [TypeOrmModule.forFeature([Badge, UserBadge]), NotificationsModule],
  controllers: [BadgesController],
  providers: [BadgeRepository, UserBadgeRepository, BadgesService],
  exports: [BadgesService],
})
export class BadgesModule {}
