import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RewardMarketplace, MarketplaceListingStatus } from '../entities/reward-marketplace.entity';
import { UserReward } from '../entities/user-reward.entity';
import { UserRewardStatus } from '../enums/user-reward-status.enum';
import { MarketplaceListDto } from '../dto/marketplace-list.dto';
import { MarketplacePurchaseDto } from '../dto/marketplace-purchase.dto';
import { User } from '../../users/entities/user.entity';
import { QueueService } from '../../queue/queue.service';

@Injectable()
export class RewardMarketplaceService {
  private readonly logger = new Logger(RewardMarketplaceService.name);

  constructor(
    @InjectRepository(RewardMarketplace)
    private readonly marketplaceRepository: Repository<RewardMarketplace>,
    @InjectRepository(UserReward)
    private readonly userRewardRepository: Repository<UserReward>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly queueService: QueueService,
  ) {}

  /**
   * List a reward in the marketplace
   */
  async listReward(
    userId: string,
    listDto: MarketplaceListDto,
  ): Promise<RewardMarketplace> {
    const { userRewardId, price } = listDto;

    // Verify user reward exists and belongs to user
    const userReward = await this.userRewardRepository.findOne({
      where: { id: userRewardId, userId },
      relations: ['reward'],
    });

    if (!userReward) {
      throw new NotFoundException(`User reward with ID ${userRewardId} not found`);
    }

    if (userReward.status !== UserRewardStatus.ACTIVE) {
      throw new BadRequestException(
        `Reward cannot be listed. Current status: ${userReward.status}`,
      );
    }

    if (!userReward.reward.isMarketplaceItem) {
      throw new BadRequestException('This reward cannot be listed in the marketplace');
    }

    // Check if already listed
    const existingListing = await this.marketplaceRepository.findOne({
      where: {
        userRewardId,
        status: MarketplaceListingStatus.ACTIVE,
      },
    });

    if (existingListing) {
      throw new BadRequestException('This reward is already listed in the marketplace');
    }

    // Create marketplace listing
    const listing = this.marketplaceRepository.create({
      sellerId: userId,
      userRewardId,
      price,
      status: MarketplaceListingStatus.ACTIVE,
    });

    return this.marketplaceRepository.save(listing);
  }

  /**
   * Get active marketplace listings
   */
  async getActiveListings(
    page: number = 1,
    limit: number = 20,
  ): Promise<{
    listings: RewardMarketplace[];
    total: number;
    page: number;
    limit: number;
  }> {
    const skip = (page - 1) * limit;

    const [listings, total] = await this.marketplaceRepository.findAndCount({
      where: { status: MarketplaceListingStatus.ACTIVE },
      relations: ['seller', 'userReward', 'userReward.reward'],
      order: { createdAt: 'DESC' },
      skip,
      take: limit,
    });

    return {
      listings,
      total,
      page,
      limit,
    };
  }

  /**
   * Purchase a reward from marketplace
   */
  async purchaseReward(
    buyerId: string,
    purchaseDto: MarketplacePurchaseDto,
  ): Promise<RewardMarketplace> {
    const { listingId } = purchaseDto;

    // Get listing
    const listing = await this.marketplaceRepository.findOne({
      where: { id: listingId },
      relations: ['seller', 'userReward', 'userReward.reward'],
    });

    if (!listing) {
      throw new NotFoundException(`Listing with ID ${listingId} not found`);
    }

    if (listing.status !== MarketplaceListingStatus.ACTIVE) {
      throw new BadRequestException(
        `Listing is not active. Current status: ${listing.status}`,
      );
    }

    if (listing.sellerId === buyerId) {
      throw new BadRequestException('Cannot purchase your own listing');
    }

    // Verify buyer exists
    const buyer = await this.userRepository.findOne({ where: { id: buyerId } });
    if (!buyer) {
      throw new NotFoundException(`Buyer with ID ${buyerId} not found`);
    }

    // TODO: Implement payment processing here
    // For now, we'll just transfer the reward

    // Transfer reward to buyer
    const userReward = listing.userReward;
    userReward.userId = buyerId;
    userReward.status = UserRewardStatus.ACTIVE;
    await this.userRewardRepository.save(userReward);

    // Update listing
    listing.status = MarketplaceListingStatus.SOLD;
    listing.buyerId = buyerId;
    listing.soldAt = new Date();
    await this.marketplaceRepository.save(listing);

    // Send notifications
    await this.queueService.addNotificationJob({
      type: 'REWARD_PURCHASED',
      userId: buyerId,
      sellerId: listing.sellerId,
      rewardId: userReward.reward.id,
      rewardName: userReward.reward.name || userReward.reward.type,
      price: listing.price,
      message: `You purchased a reward from the marketplace`,
    });

    await this.queueService.addNotificationJob({
      type: 'REWARD_SOLD',
      userId: listing.sellerId,
      buyerId: buyerId,
      rewardId: userReward.reward.id,
      rewardName: userReward.reward.name || userReward.reward.type,
      price: listing.price,
      message: `Your reward was sold in the marketplace`,
    });

    this.logger.log(
      `Reward ${userReward.id} purchased by ${buyerId} from ${listing.sellerId} for ${listing.price}`,
    );

    return listing;
  }

  /**
   * Cancel a marketplace listing
   */
  async cancelListing(userId: string, listingId: string): Promise<RewardMarketplace> {
    const listing = await this.marketplaceRepository.findOne({
      where: { id: listingId, sellerId: userId },
    });

    if (!listing) {
      throw new NotFoundException(`Listing with ID ${listingId} not found`);
    }

    if (listing.status !== MarketplaceListingStatus.ACTIVE) {
      throw new BadRequestException(
        `Listing cannot be cancelled. Current status: ${listing.status}`,
      );
    }

    listing.status = MarketplaceListingStatus.CANCELLED;
    return this.marketplaceRepository.save(listing);
  }

  /**
   * Get user's marketplace listings
   */
  async getUserListings(
    userId: string,
    status?: MarketplaceListingStatus,
  ): Promise<RewardMarketplace[]> {
    const where: any = { sellerId: userId };
    if (status) {
      where.status = status;
    }

    return this.marketplaceRepository.find({
      where,
      relations: ['userReward', 'userReward.reward'],
      order: { createdAt: 'DESC' },
    });
  }
}
