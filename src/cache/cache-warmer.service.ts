import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CacheService } from './cache.service';
import { CacheKey, CACHE_TTL } from './cache.constants';

/**
 * CacheWarmerService
 *
 * Runs once after the application has fully bootstrapped.
 * Loads "hot" data — frequently read, rarely written — into Redis
 * so that the first real requests are served from cache rather than the DB.
 *
 * Add more warming tasks as read-heavy patterns are identified.
 */
@Injectable()
export class CacheWarmerService implements OnApplicationBootstrap {
  private readonly logger = new Logger(CacheWarmerService.name);

  constructor(
    private readonly cache: CacheService,
    /**
     * Inject repositories for the entities whose data you want to warm.
     * Example shown with a hypothetical UserEntity — replace/extend as needed.
     * If you don't yet have these entities, just remove the corresponding blocks.
     */
    // @InjectRepository(UserEntity)
    // private readonly userRepo: Repository<UserEntity>,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    this.logger.log('Starting cache warm-up…');
    await Promise.allSettled([
      this.warmTokenPrices(),
      // this.warmActiveUsers(),   // uncomment and implement when needed
    ]);
    this.logger.log('Cache warm-up complete.');
  }

  /**
   * Example: warm known token prices.
   * Replace with a real price-feed service call when available.
   */
  private async warmTokenPrices(): Promise<void> {
    const tokens = ['XLM', 'USDC', 'BNB', 'ETH'];
    for (const symbol of tokens) {
      const alreadyCached = await this.cache.get(CacheKey.tokenPrice(symbol));
      if (alreadyCached) {
        this.logger.debug(`Token price already cached: ${symbol}`);
        continue;
      }
      // TODO: replace stub with real price-feed service
      const price = { symbol, usd: 0, warmedAt: new Date().toISOString() };
      await this.cache.set(CacheKey.tokenPrice(symbol), price, CACHE_TTL.TOKEN_PRICE);
      this.logger.debug(`Warmed token price: ${symbol}`);
    }
  }

  /**
   * Template for warming active user profiles.
   * Uncomment and wire up once UserEntity is injectable here.
   *
   * private async warmActiveUsers(): Promise<void> {
   *   const users = await this.userRepo.find({ where: { isActive: true }, take: 500 });
   *   await Promise.all(
   *     users.map((u) =>
   *       this.cache.set(CacheKey.user(u.id), u, CACHE_TTL.USER),
   *     ),
   *   );
   *   this.logger.debug(`Warmed ${users.length} active user profiles`);
   * }
   */
}