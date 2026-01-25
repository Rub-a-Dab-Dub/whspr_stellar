import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan, In, MoreThanOrEqual } from 'typeorm';
import { Reward } from '../entities/reward.entity';
import { UserReward } from '../entities/user-reward.entity';
import { UserRewardStatus } from '../enums/user-reward-status.enum';
import { RewardType } from '../enums/reward-type.enum';
import { GrantRewardDto } from '../dto/grant-reward.dto';
import { CreateRewardDto } from '../dto/create-reward.dto';
import { User } from '../../users/entities/user.entity';
import { QueueService } from '../../queue/queue.service';
import { XpService } from '../../users/services/xp.service';

@Injectable()
export class RewardsService {
  private readonly logger = new Logger(RewardsService.name);

  constructor(
    @InjectRepository(Reward)
    private readonly rewardRepository: Repository<Reward>,
    @InjectRepository(UserReward)
    private readonly userRewardRepository: Repository<UserReward>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly queueService: QueueService,
    private readonly xpService: XpService,
  ) {}

  /**
   * Create a new reward definition
   */
  async createReward(createRewardDto: CreateRewardDto): Promise<Reward> {
    const reward = this.rewardRepository.create(createRewardDto);
    return this.rewardRepository.save(reward);
  }

  /**
   * Get all active rewards
   */
  async getAllRewards(): Promise<Reward[]> {
    return this.rewardRepository.find({
      where: { isActive: true },
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * Get reward by ID
   */
  async getRewardById(id: string): Promise<Reward> {
    const reward = await this.rewardRepository.findOne({ where: { id } });
    if (!reward) {
      throw new NotFoundException(`Reward with ID ${id} not found`);
    }
    return reward;
  }

  /**
   * Grant a reward to a user
   */
  async grantReward(grantRewardDto: GrantRewardDto): Promise<UserReward> {
    const { userId, rewardId, grantedByUserId, eventName, metadata } = grantRewardDto;

    // Verify user exists
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException(`User with ID ${userId} not found`);
    }

    // Verify reward exists and is active
    const reward = await this.rewardRepository.findOne({ where: { id: rewardId } });
    if (!reward) {
      throw new NotFoundException(`Reward with ID ${rewardId} not found`);
    }
    if (!reward.isActive) {
      throw new BadRequestException(`Reward with ID ${rewardId} is not active`);
    }

    // Check stacking rules
    await this.checkStackingRules(userId, reward);

    // Calculate expiration date
    const expiresAt = reward.expirationDays
      ? new Date(Date.now() + reward.expirationDays * 24 * 60 * 60 * 1000)
      : null;

    // Create user reward
    const userReward = this.userRewardRepository.create({
      userId,
      rewardId,
      status: UserRewardStatus.ACTIVE,
      expiresAt,
      grantedByUserId: grantedByUserId || null,
      eventName: eventName || null,
      metadata: metadata || {},
    });

    const savedUserReward = await this.userRewardRepository.save(userReward);

    // Apply reward effect immediately
    await this.applyRewardEffect(userId, reward);

    // Send notification
    await this.sendRewardNotification(userId, reward, eventName);

    this.logger.log(`Reward ${rewardId} granted to user ${userId}`);
    return savedUserReward;
  }

  /**
   * Check stacking rules before granting reward
   */
  private async checkStackingRules(userId: string, reward: Reward): Promise<void> {
    if (reward.stackLimit === 0) {
      // Check if user already has this reward
      const existingReward = await this.userRewardRepository.findOne({
        where: {
          userId,
          rewardId: reward.id,
          status: In([UserRewardStatus.ACTIVE, UserRewardStatus.REDEEMED]),
        },
      });

      if (existingReward) {
        throw new BadRequestException(
          `User already has this reward and it cannot be stacked`,
        );
      }
    } else if (reward.stackLimit > 0) {
      // Count active instances of this reward
      const activeCount = await this.userRewardRepository.count({
        where: {
          userId,
          rewardId: reward.id,
          status: UserRewardStatus.ACTIVE,
        },
      });

      if (activeCount >= reward.stackLimit) {
        throw new BadRequestException(
          `User has reached the maximum stack limit (${reward.stackLimit}) for this reward`,
        );
      }
    }
  }

  /**
   * Apply reward effect based on type
   */
  private async applyRewardEffect(userId: string, reward: Reward): Promise<void> {
    switch (reward.type) {
      case RewardType.XP_BOOST:
        // Apply XP multiplier boost
        const user = await this.userRepository.findOne({ where: { id: userId } });
        if (user) {
          const boostMultiplier = parseFloat(reward.value.toString());
          user.xpMultiplier = parseFloat(user.xpMultiplier.toString()) * boostMultiplier;
          await this.userRepository.save(user);
        }
        break;

      case RewardType.PREMIUM_DAYS:
        // Grant premium days
        const premiumUser = await this.userRepository.findOne({ where: { id: userId } });
        if (premiumUser) {
          premiumUser.isPremium = true;
          // Store premium expiration in metadata or separate table
          // For now, just set isPremium to true
          await this.userRepository.save(premiumUser);
        }
        break;

      case RewardType.CUSTOM_BADGE:
        // Badge is just stored in inventory, no immediate effect
        break;

      default:
        this.logger.warn(`Unknown reward type: ${reward.type}`);
    }
  }

  /**
   * Send reward notification
   */
  private async sendRewardNotification(
    userId: string,
    reward: Reward,
    eventName?: string,
  ): Promise<void> {
    await this.queueService.addNotificationJob({
      type: 'REWARD_GRANTED',
      userId,
      rewardId: reward.id,
      rewardName: reward.name || reward.type,
      rewardType: reward.type,
      eventName: eventName || null,
      message: `You received a reward: ${reward.name || reward.type}`,
    });
  }

  /**
   * Get user inventory
   */
  async getUserInventory(
    userId: string,
    status?: UserRewardStatus,
    includeExpired: boolean = false,
    page: number = 1,
    limit: number = 20,
  ): Promise<{
    rewards: UserReward[];
    total: number;
    page: number;
    limit: number;
  }> {
    const skip = (page - 1) * limit;
    const where: any = { userId };

    if (status) {
      where.status = status;
    } else if (!includeExpired) {
      // Only show active and redeemed rewards, exclude expired
      where.status = In([UserRewardStatus.ACTIVE, UserRewardStatus.REDEEMED]);
    }

    const [rewards, total] = await this.userRewardRepository.findAndCount({
      where,
      relations: ['reward'],
      order: { createdAt: 'DESC' },
      skip,
      take: limit,
    });

    // Filter out expired rewards if not including them
    let filteredRewards = rewards;
    if (!includeExpired) {
      const now = new Date();
      filteredRewards = rewards.filter(
        (ur) => !ur.expiresAt || ur.expiresAt > now,
      );
    }

    return {
      rewards: filteredRewards,
      total,
      page,
      limit,
    };
  }

  /**
   * Redeem a reward
   */
  async redeemReward(userId: string, userRewardId: string): Promise<UserReward> {
    const userReward = await this.userRewardRepository.findOne({
      where: { id: userRewardId, userId },
      relations: ['reward'],
    });

    if (!userReward) {
      throw new NotFoundException(`User reward with ID ${userRewardId} not found`);
    }

    if (userReward.status !== UserRewardStatus.ACTIVE) {
      throw new BadRequestException(
        `Reward is not active. Current status: ${userReward.status}`,
      );
    }

    // Check if expired
    if (userReward.expiresAt && userReward.expiresAt < new Date()) {
      userReward.status = UserRewardStatus.EXPIRED;
      await this.userRewardRepository.save(userReward);
      throw new BadRequestException('Reward has expired');
    }

    // Apply redemption effect
    await this.applyRedemptionEffect(userId, userReward.reward);

    // Update status
    userReward.status = UserRewardStatus.REDEEMED;
    userReward.redeemedAt = new Date();
    await this.userRewardRepository.save(userReward);

    this.logger.log(`Reward ${userRewardId} redeemed by user ${userId}`);
    return userReward;
  }

  /**
   * Apply redemption effect
   */
  private async applyRedemptionEffect(userId: string, reward: Reward): Promise<void> {
    // For most rewards, the effect is already applied on grant
    // This method can be used for rewards that need activation on redemption
    switch (reward.type) {
      case RewardType.CUSTOM_BADGE:
        // Badge is now "equipped" or "active"
        this.logger.log(`Badge ${reward.id} activated for user ${userId}`);
        break;
      default:
        // Other rewards are already applied
        break;
    }
  }

  /**
   * Trade a reward to another user
   */
  async tradeReward(
    userId: string,
    userRewardId: string,
    targetUserId: string,
  ): Promise<UserReward> {
    const userReward = await this.userRewardRepository.findOne({
      where: { id: userRewardId, userId },
      relations: ['reward'],
    });

    if (!userReward) {
      throw new NotFoundException(`User reward with ID ${userRewardId} not found`);
    }

    if (userReward.status !== UserRewardStatus.ACTIVE) {
      throw new BadRequestException(
        `Reward cannot be traded. Current status: ${userReward.status}`,
      );
    }

    if (!userReward.reward.isTradeable) {
      throw new BadRequestException('This reward is not tradeable');
    }

    // Verify target user exists
    const targetUser = await this.userRepository.findOne({ where: { id: targetUserId } });
    if (!targetUser) {
      throw new NotFoundException(`Target user with ID ${targetUserId} not found`);
    }

    // Check stacking rules for target user
    await this.checkStackingRules(targetUserId, userReward.reward);

    // Transfer reward
    userReward.userId = targetUserId;
    userReward.status = UserRewardStatus.TRADED;
    userReward.tradedToUserId = targetUserId;
    await this.userRewardRepository.save(userReward);

    // Send notifications
    await this.queueService.addNotificationJob({
      type: 'REWARD_TRADED',
      userId: targetUserId,
      fromUserId: userId,
      rewardId: userReward.reward.id,
      rewardName: userReward.reward.name || userReward.reward.type,
      message: `You received a reward via trade`,
    });

    this.logger.log(`Reward ${userRewardId} traded from user ${userId} to ${targetUserId}`);
    return userReward;
  }

  /**
   * Gift a reward to another user
   */
  async giftReward(
    userId: string,
    userRewardId: string,
    recipientUserId: string,
  ): Promise<UserReward> {
    const userReward = await this.userRewardRepository.findOne({
      where: { id: userRewardId, userId },
      relations: ['reward'],
    });

    if (!userReward) {
      throw new NotFoundException(`User reward with ID ${userRewardId} not found`);
    }

    if (userReward.status !== UserRewardStatus.ACTIVE) {
      throw new BadRequestException(
        `Reward cannot be gifted. Current status: ${userReward.status}`,
      );
    }

    if (!userReward.reward.isGiftable) {
      throw new BadRequestException('This reward is not giftable');
    }

    // Verify recipient exists
    const recipient = await this.userRepository.findOne({ where: { id: recipientUserId } });
    if (!recipient) {
      throw new NotFoundException(`Recipient user with ID ${recipientUserId} not found`);
    }

    // Check stacking rules for recipient
    await this.checkStackingRules(recipientUserId, userReward.reward);

    // Transfer reward
    userReward.userId = recipientUserId;
    userReward.status = UserRewardStatus.GIFTED;
    userReward.giftedToUserId = recipientUserId;
    await this.userRewardRepository.save(userReward);

    // Send notifications
    await this.queueService.addNotificationJob({
      type: 'REWARD_GIFTED',
      userId: recipientUserId,
      fromUserId: userId,
      rewardId: userReward.reward.id,
      rewardName: userReward.reward.name || userReward.reward.type,
      message: `You received a gift reward`,
    });

    this.logger.log(`Reward ${userRewardId} gifted from user ${userId} to ${recipientUserId}`);
    return userReward;
  }

  /**
   * Process expired rewards
   */
  async processExpiredRewards(): Promise<number> {
    const now = new Date();
    const expiredRewards = await this.userRewardRepository.find({
      where: {
        status: UserRewardStatus.ACTIVE,
        expiresAt: LessThan(now),
      },
      relations: ['reward'],
    });

    for (const userReward of expiredRewards) {
      userReward.status = UserRewardStatus.EXPIRED;
      await this.userRewardRepository.save(userReward);

      // Revert reward effects if needed
      await this.revertRewardEffect(userReward.userId, userReward.reward);

      // Send notification
      await this.queueService.addNotificationJob({
        type: 'REWARD_EXPIRED',
        userId: userReward.userId,
        rewardId: userReward.reward.id,
        rewardName: userReward.reward.name || userReward.reward.type,
        message: `Your reward has expired: ${userReward.reward.name || userReward.reward.type}`,
      });
    }

    this.logger.log(`Processed ${expiredRewards.length} expired rewards`);
    return expiredRewards.length;
  }

  /**
   * Revert reward effect when expired
   */
  private async revertRewardEffect(userId: string, reward: Reward): Promise<void> {
    switch (reward.type) {
      case RewardType.XP_BOOST:
        // Revert XP multiplier
        const user = await this.userRepository.findOne({ where: { id: userId } });
        if (user) {
          const boostMultiplier = parseFloat(reward.value.toString());
          user.xpMultiplier = parseFloat(user.xpMultiplier.toString()) / boostMultiplier;
          // Ensure multiplier doesn't go below 1.0
          if (user.xpMultiplier < 1.0) {
            user.xpMultiplier = 1.0;
          }
          await this.userRepository.save(user);
        }
        break;

      case RewardType.PREMIUM_DAYS:
        // Premium days expiration handled separately
        break;

      default:
        // Other rewards don't need reversion
        break;
    }
  }

  /**
   * Grant special event reward
   */
  async grantEventReward(
    userId: string,
    rewardId: string,
    eventName: string,
    metadata?: Record<string, any>,
  ): Promise<UserReward> {
    return this.grantReward({
      userId,
      rewardId,
      eventName,
      metadata,
    });
  }
}
