import {
  Injectable,
  NotFoundException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserBadge, BadgeSource } from '../entities/user-badge.entity';
import { User } from '../entities/user.entity';
import { Badge } from '../entities/badge.entity';

@Injectable()
export class UserBadgeService {
  constructor(
    @InjectRepository(UserBadge)
    private readonly userBadgeRepo: Repository<UserBadge>,

    @InjectRepository(User)
    private readonly userRepo: Repository<User>,

    @InjectRepository(Badge)
    private readonly badgeRepo: Repository<Badge>,
  ) {}

  async grantBadge(
    userId: string,
    badgeId: string,
    reason: string,
    adminUsername: string,
  ) {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    const badge = await this.badgeRepo.findOne({ where: { id: badgeId } });
    if (!badge) throw new NotFoundException('Badge not found');

    if (!badge.isActive) throw new ConflictException('Badge is inactive');

    const existing = await this.userBadgeRepo.findOne({
      where: { user: { id: userId }, badge: { id: badgeId } },
    });

    if (existing) throw new ConflictException('User already holds this badge');

    const userBadge = this.userBadgeRepo.create({
      user,
      badge,
      source: BadgeSource.MANUAL,
      awardedBy: adminUsername,
      reason,
    });

    await this.userBadgeRepo.save(userBadge);

    // 🔔 In-app notification
    // await this.notificationService.send(...)

    // 📜 Audit log
    // await this.auditService.log('GRANT_BADGE', ...)

    return userBadge;
  }

  async revokeBadge(
    userId: string,
    badgeId: string,
    reason: string,
    adminUsername: string,
  ) {
    const record = await this.userBadgeRepo.findOne({
      where: { user: { id: userId }, badge: { id: badgeId } },
    });

    if (!record) throw new NotFoundException('User does not hold this badge');

    await this.userBadgeRepo.remove(record);

    // 🔔 Notification
    // 📜 Audit log

    return { message: 'Badge revoked successfully' };
  }

  async listUserBadges(userId: string) {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    return this.userBadgeRepo.find({
      where: { user: { id: userId } },
      relations: ['badge'],
    });
  }
}
