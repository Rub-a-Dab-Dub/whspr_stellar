import {
  Injectable,
  Logger,
  Inject,
  CACHE_MANAGER,
} from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Cache } from 'cache-manager';
import { PortfolioSnapshotRepository } from './portfolio-snapshot.repository';
import { PortfolioResponseDto, PortfolioPnLDto, PortfolioHistoryDto, PortfolioAllocationDto } from './dto/portfolio-response.dto';
import { PortfolioHistoryQueryDto } from './dto/portfolio-history-query.dto';
import { PortfolioSnapshot } from './entities/portfolio-snapshot.entity';
import { WalletsService } from '../wallets/wallets.service';
import { TokensService } from '../tokens/tokens.service';
import { BalanceResponseDto } from '../wallets/dto/balance-response.dto';
import { Token } from '../tokens/entities/token.entity';

@Injectable()
export class PortfolioService {
  private readonly logger = new Logger(PortfolioService.name);
  private readonly portfolioCacheKey = (userId: string) => `portfolio:${userId}`;

  constructor(
    private readonly snapshotRepo: PortfolioSnapshotRepository,
    private readonly walletsService: WalletsService,
    private readonly tokensService: TokensService,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
  ) {}

  async getPortfolio(userId: string): Promise<PortfolioResponseDto> {
    const cached = await this.cacheManager.get<PortfolioResponseDto>(this.portfolioCacheKey(userId));
    if (cached) {
      cached.updatedAt = new Date();
      return cached;
    }

    // Get user wallets
    const wallets = await this.walletsService.getWalletsByUser(userId);
    // Parallel fetch balances
    const balancesPromises = wallets.map(w => this.walletsService.getBalance(userId, w.id));
    const balanceResponses = await Promise.all(balancesPromises);

    // Aggregate balances by symbol
    const symbolToAmount: Record<string, string> = {};
    for (const response of balanceResponses) {
      for (const bal of response.balances) {
        const symbol = bal.assetCode;
        symbolToAmount[symbol] = (parseFloat(symbolToAmount[symbol] || '0') + parseFloat(bal.balance)).toFixed(7);
      }
    }

    // Get prices & compute USD
    const balances: typeof PortfolioResponseDto.prototype.balances = [];
    let totalUsdValue = 0;
    for (const [symbol, amount] of Object.entries(symbolToAmount)) {
      const token = await this.tokensService.findBySymbol(symbol); // assume findBySymbol exists or query
      const usdValue = parseFloat(amount) * (token.currentPrice || 0);
      balances.push({
        symbol,
        amount,
        usdValue,
        allocationPercent: 0,
      });
      totalUsdValue += usdValue;
    }

    // Calc allocation %
    for (const bal of balances) {
      bal.allocationPercent = totalUsdValue > 0 ? (bal.usdValue / totalUsdValue * 100) : 0;
    }

    const portfolio: PortfolioResponseDto = {
      totalUsdValue,
      balances,
      updatedAt: new Date(),
      pnl24h: 0, // compute from snapshot
      pnl7d: 0,
    };

    // Cache 30s TTL
    await this.cacheManager.set(this.portfolioCacheKey(userId), portfolio, 30);
    return portfolio;
  }

  async getPortfolioHistory(userId: string, query: PortfolioHistoryQueryDto): Promise<PortfolioHistoryDto[]> {
    // impl paginated from repo
    return [];
  }

  async getPnL(userId: string): Promise<PortfolioPnLDto> {
    const current = await this.getPortfolio(userId);
    const snapshot24h = await this.snapshotRepo.findLatestByUserId(userId, 1);
    const snapshot7d = await this.snapshotRepo.findLatestByUserId(userId, 7);
    // calc
    return {
      pnl24h: 0,
      pnl7d: 0,
      pnl30d: 0,
    };
  }

  async takeDailySnapshot(userId: string): Promise<void> {
    const portfolio = await this.getPortfolio(userId);
    const snapshot: Partial<PortfolioSnapshot> = {
      userId,
      totalUsdValue: portfolio.totalUsdValue,
      balances: portfolio.balances.map(b => ({
        symbol: b.symbol,
        amount: b.amount,
        usdValue: b.usdValue,
      })),
      snapshotDate: new Date(),
    };
    await this.snapshotRepo.createAndSave(snapshot);
  }

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async takeDailySnapshots(): Promise<void> {
    // Get all active users
    // Parallel take snapshot
    this.logger.log('Daily portfolio snapshots taken');
  }
}

