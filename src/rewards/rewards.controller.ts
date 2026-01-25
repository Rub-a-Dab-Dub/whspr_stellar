import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
  ParseUUIDPipe,
} from '@nestjs/common';
import { RewardsService } from './services/rewards.service';
import { RewardAnalyticsService } from './services/reward-analytics.service';
import { RewardMarketplaceService } from './services/reward-marketplace.service';
import { GrantRewardDto } from './dto/grant-reward.dto';
import { CreateRewardDto } from './dto/create-reward.dto';
import { RedeemRewardDto } from './dto/redeem-reward.dto';
import { TradeRewardDto } from './dto/trade-reward.dto';
import { GiftRewardDto } from './dto/gift-reward.dto';
import { InventoryQueryDto } from './dto/inventory-query.dto';
import { MarketplaceListDto } from './dto/marketplace-list.dto';
import { MarketplacePurchaseDto } from './dto/marketplace-purchase.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@Controller('rewards')
@UseGuards(JwtAuthGuard)
export class RewardsController {
  constructor(
    private readonly rewardsService: RewardsService,
    private readonly analyticsService: RewardAnalyticsService,
    private readonly marketplaceService: RewardMarketplaceService,
  ) {}

  /**
   * Create a new reward definition (Admin only)
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  createReward(@Body() createRewardDto: CreateRewardDto) {
    return this.rewardsService.createReward(createRewardDto);
  }

  /**
   * Get all active rewards
   */
  @Get()
  getAllRewards() {
    return this.rewardsService.getAllRewards();
  }

  /**
   * Get user inventory
   */
  @Get('inventory')
  getUserInventory(
    @CurrentUser() user: any,
    @Query() query: InventoryQueryDto,
  ) {
    return this.rewardsService.getUserInventory(
      user.userId,
      query.status,
      query.includeExpired,
      query.page,
      query.limit,
    );
  }

  /**
   * Get reward by ID
   */
  @Get(':id')
  getRewardById(@Param('id', ParseUUIDPipe) id: string) {
    return this.rewardsService.getRewardById(id);
  }

  /**
   * Grant a reward to a user (Admin only)
   */
  @Post('grant')
  @HttpCode(HttpStatus.CREATED)
  grantReward(@Body() grantRewardDto: GrantRewardDto) {
    return this.rewardsService.grantReward(grantRewardDto);
  }

  /**
   * Redeem a reward
   */
  @Post('redeem')
  @HttpCode(HttpStatus.OK)
  redeemReward(
    @CurrentUser() user: any,
    @Body() redeemRewardDto: RedeemRewardDto,
  ) {
    return this.rewardsService.redeemReward(user.userId, redeemRewardDto.userRewardId);
  }

  /**
   * Trade a reward
   */
  @Post('trade')
  @HttpCode(HttpStatus.OK)
  tradeReward(
    @CurrentUser() user: any,
    @Body() tradeRewardDto: TradeRewardDto,
  ) {
    return this.rewardsService.tradeReward(
      user.userId,
      tradeRewardDto.userRewardId,
      tradeRewardDto.targetUserId,
    );
  }

  /**
   * Gift a reward
   */
  @Post('gift')
  @HttpCode(HttpStatus.OK)
  giftReward(
    @CurrentUser() user: any,
    @Body() giftRewardDto: GiftRewardDto,
  ) {
    return this.rewardsService.giftReward(
      user.userId,
      giftRewardDto.userRewardId,
      giftRewardDto.recipientUserId,
    );
  }

  /**
   * Grant special event reward
   */
  @Post('event')
  @HttpCode(HttpStatus.CREATED)
  grantEventReward(
    @Body() grantRewardDto: GrantRewardDto,
  ) {
    return this.rewardsService.grantEventReward(
      grantRewardDto.userId,
      grantRewardDto.rewardId,
      grantRewardDto.eventName || 'special_event',
      grantRewardDto.metadata,
    );
  }

  /**
   * Get reward analytics
   */
  @Get('analytics/overview')
  getAnalyticsOverview() {
    return Promise.all([
      this.analyticsService.getTotalRewardsGranted(),
      this.analyticsService.getRewardsByType(),
      this.analyticsService.getRedemptionRate(),
      this.analyticsService.getTradingStats(),
    ]).then(([total, byType, redemption, trading]) => ({
      totalRewardsGranted: total,
      rewardsByType: byType,
      redemptionRate: redemption,
      tradingStats: trading,
    }));
  }

  @Get('analytics/top-users')
  getTopUsers(@Query('limit') limit?: number) {
    return this.analyticsService.getTopUsersByRewards(limit ? parseInt(limit.toString()) : 10);
  }

  @Get('analytics/events')
  getRewardsByEvent() {
    return this.analyticsService.getRewardsByEvent();
  }

  /**
   * Marketplace endpoints
   */
  @Post('marketplace/list')
  @HttpCode(HttpStatus.CREATED)
  listReward(
    @CurrentUser() user: any,
    @Body() listDto: MarketplaceListDto,
  ) {
    return this.marketplaceService.listReward(user.userId, listDto);
  }

  @Get('marketplace/listings')
  getMarketplaceListings(
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.marketplaceService.getActiveListings(
      page ? parseInt(page.toString()) : 1,
      limit ? parseInt(limit.toString()) : 20,
    );
  }

  @Post('marketplace/purchase')
  @HttpCode(HttpStatus.OK)
  purchaseReward(
    @CurrentUser() user: any,
    @Body() purchaseDto: MarketplacePurchaseDto,
  ) {
    return this.marketplaceService.purchaseReward(user.userId, purchaseDto);
  }

  @Post('marketplace/cancel/:listingId')
  @HttpCode(HttpStatus.OK)
  cancelListing(
    @CurrentUser() user: any,
    @Param('listingId', ParseUUIDPipe) listingId: string,
  ) {
    return this.marketplaceService.cancelListing(user.userId, listingId);
  }

  @Get('marketplace/my-listings')
  getMyListings(@CurrentUser() user: any) {
    return this.marketplaceService.getUserListings(user.userId);
  }
}
