import { Injectable } from '@nestjs/common';
import { ConfigService } from '../platform-config/config.service';

/**
 * Example service demonstrating how to use ConfigService
 * in your application modules
 */
@Injectable()
export class ExampleUsageService {
  constructor(private readonly configService: ConfigService) {}

  /**
   * Calculate XP with dynamic multiplier
   */
  async calculateXP(baseXP: number): Promise<number> {
    const multiplier = await this.configService.get<number>('xp_multiplier');
    return Math.floor(baseXP * (multiplier ?? 1.0));
  }

  /**
   * Calculate platform fee for a transaction
   */
  async calculatePlatformFee(amount: number): Promise<number> {
    const feePercentage = await this.configService.get<number>(
      'platform_fee_percentage',
    );
    return (amount * (feePercentage ?? 2.0)) / 100;
  }

  /**
   * Check if a reaction emoji is allowed
   */
  async isReactionAllowed(emoji: string): Promise<boolean> {
    const allowedReactions = await this.configService.get<string[]>(
      'allowed_reactions',
    );
    return allowedReactions?.includes(emoji) ?? false;
  }

  /**
   * Get rate limit for messages
   */
  async getMessageRateLimit(): Promise<number> {
    const limit = await this.configService.get<number>(
      'rate_limit_messages_per_minute',
    );
    return limit ?? 10;
  }

  /**
   * Check if a feature is enabled
   */
  async isFeatureEnabled(featureName: string): Promise<boolean> {
    const flags = await this.configService.get<Record<string, boolean>>(
      'feature_flags',
    );
    return flags?.[featureName] ?? false;
  }

  /**
   * Example: Process a tip with dynamic fee calculation
   */
  async processTip(amount: number, fromUserId: string, toUserId: string) {
    // Check if tipping is enabled
    const tippingEnabled = await this.isFeatureEnabled('tipping');
    if (!tippingEnabled) {
      throw new Error('Tipping feature is currently disabled');
    }

    // Calculate platform fee
    const platformFee = await this.calculatePlatformFee(amount);
    const recipientAmount = amount - platformFee;

    // Award XP to tipper
    const baseXP = 20;
    const xpAwarded = await this.calculateXP(baseXP);

    return {
      amount,
      platformFee,
      recipientAmount,
      xpAwarded,
    };
  }
}
