import { Injectable, NotFoundException, Inject, Logger } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { DataSource } from 'typeorm';
import { XPTransactionRepository } from './repositories/xp-transaction.repository';
import { CreateXPTransactionDto } from './dto/create-xp-transaction.dto';
import { UpdateXPTransactionDto } from './dto/update-xp-transaction.dto';
import { VoidXPTransactionDto } from './dto/void-xp-transaction.dto';
import { QueryXPTransactionDto } from './dto/query-xp-transaction.dto';
import { XPTransaction, TransactionStatus } from './entities/xp-transaction.entity';

@Injectable()
export class XPTransactionService {
  private readonly logger = new Logger(XPTransactionService.name);
  private readonly FRAUD_THRESHOLD = 1000;
  private readonly CACHE_TTL = 300;

  constructor(
    private readonly xpRepository: XPTransactionRepository,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
    private eventEmitter: EventEmitter2,
    private dataSource: DataSource,
  ) {}

  async create(dto: CreateXPTransactionDto): Promise<XPTransaction> {
    const multiplier = dto.multiplier || 1.0;
    const finalAmount = Math.floor(dto.amount * multiplier);

    const transaction = this.xpRepository.create({
      ...dto,
      multiplier,
      finalAmount,
      status: TransactionStatus.ACTIVE,
    });

    const saved = await this.xpRepository.save(transaction);
    await this.checkFraudAndAlert(dto.userId);
    await this.invalidateUserCache(dto.userId);
    this.eventEmitter.emit('xp.created', { userId: dto.userId, amount: finalAmount });

    return saved;
  }

  async findAll(query: QueryXPTransactionDto) {
    const cacheKey = `xp:query:${JSON.stringify(query)}`;
    const cached = await this.cacheManager.get(cacheKey);

    if (cached) return cached;

    const result = await this.xpRepository.findPaginated(query);
    await this.cacheManager.set(cacheKey, result, this.CACHE_TTL);
    return result;
  }

  async findOne(id: string): Promise<XPTransaction> {
    const transaction = await this.xpRepository.findOne({
      where: { id },
      relations: ['user'],
    });

    if (!transaction) {
      throw new NotFoundException(`XP Transaction with ID ${id} not found`);
    }
    return transaction;
  }

  async update(id: string, dto: UpdateXPTransactionDto): Promise<XPTransaction> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const existing = await queryRunner.manager.findOne(XPTransaction, {
        where: { id },
        relations: ['user'],
      });

      if (!existing) {
        throw new NotFoundException(`XP Transaction with ID ${id} not found`);
      }

      const adjustment = queryRunner.manager.create(XPTransaction, {
        userId: existing.userId,
        actionType: existing.actionType,
        amount: dto.amount,
        multiplier: 1.0,
        finalAmount: dto.amount,
        reason: dto.reason,
        adjustedBy: dto.adjustedBy,
        status: TransactionStatus.ACTIVE,
        metadata: {
          originalTransactionId: id,
          adjustmentType: 'retroactive',
        },
      });

      const saved = await queryRunner.manager.save(adjustment);
      await queryRunner.commitTransaction();

      await this.invalidateUserCache(existing.userId);
      this.eventEmitter.emit('xp.adjusted', {
        userId: existing.userId,
        amount: dto.amount,
        reason: dto.reason,
      });

      return saved;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async void(id: string, dto: VoidXPTransactionDto): Promise<XPTransaction> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const transaction = await queryRunner.manager.findOne(XPTransaction, {
        where: { id },
        relations: ['user'],
      });

      if (!transaction) {
        throw new NotFoundException(`XP Transaction with ID ${id} not found`);
      }

      transaction.status = TransactionStatus.VOIDED;
      transaction.voidedBy = dto.voidedBy;
      transaction.voidReason = dto.voidReason;

      const voided = await queryRunner.manager.save(transaction);
      await queryRunner.commitTransaction();

      await this.invalidateUserCache(transaction.userId);
      this.eventEmitter.emit('xp.voided', {
        userId: transaction.userId,
        amount: -transaction.finalAmount,
        reason: dto.voidReason,
      });

      return voided;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async getAggregates(startDate?: string, endDate?: string) {
    const cacheKey = `xp:aggregates:${startDate}:${endDate}`;
    const cached = await this.cacheManager.get(cacheKey);
    if (cached) return cached;

    const [globalStats, topUsers, distribution, timeline] = await Promise.all([
      this.xpRepository.getGlobalAggregates(
        startDate ? new Date(startDate) : undefined,
        endDate ? new Date(endDate) : undefined,
      ),
      this.xpRepository.getTopUsers(10),
      this.xpRepository.getDistributionByType(),
      this.xpRepository.getXPTimeline(30),
    ]);

    const result = {
      ...globalStats,
      topUsers,
      distributionByType: distribution,
      timeline,
    };

    await this.cacheManager.set(cacheKey, result, this.CACHE_TTL);
    return result;
  }

  async getUserTotal(userId: string): Promise<number> {
    const cacheKey = `xp:user:${userId}:total`;
    const cached = await this.cacheManager.get<number>(cacheKey);
    if (cached !== null && cached !== undefined) return cached;

    const total = await this.xpRepository.getUserTotalXP(userId);
    await this.cacheManager.set(cacheKey, total, this.CACHE_TTL);
    return total;
  }

  async exportToCSV(query: QueryXPTransactionDto, anonymize: boolean = false) {
    const { items } = await this.xpRepository.findPaginated({
      ...query,
      limit: 10000,
    });

    return items.map((item) => ({
      id: item.id,
      userId: anonymize ? this.anonymizeUserId(item.userId) : item.userId,
      username: anonymize ? 'Anonymous' : item.user?.username || 'N/A',
      actionType: item.actionType,
      amount: item.amount,
      multiplier: item.multiplier,
      finalAmount: item.finalAmount,
      status: item.status,
      reason: item.reason || '',
      transactionId: item.transactionId || '',
      createdAt: item.createdAt.toISOString(),
    }));
  }

  private async checkFraudAndAlert(userId: string): Promise<void> {
    const xpInLastHour = await this.xpRepository.detectSuspiciousActivity(userId, 1);

    if (xpInLastHour > this.FRAUD_THRESHOLD) {
      this.logger.warn(`Suspicious activity: user ${userId}: ${xpInLastHour} XP in last hour`);

      this.eventEmitter.emit('fraud.detected', {
        userId,
        xpAmount: xpInLastHour,
        threshold: this.FRAUD_THRESHOLD,
        timestamp: new Date(),
      });
    }
  }

  private async invalidateUserCache(userId: string): Promise<void> {
    await this.cacheManager.del(`xp:user:${userId}:total`);
    const keys = await this.cacheManager.store.keys();
    const aggregateKeys = keys.filter((k) => k.startsWith('xp:aggregates:'));
    await Promise.all(aggregateKeys.map((k) => this.cacheManager.del(k)));
  }

  private anonymizeUserId(userId: string): string {
    return `user_${userId.substring(0, 8)}***`;
  }
}
