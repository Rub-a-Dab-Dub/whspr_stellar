import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Cron, CronExpression } from '@nestjs/schedule';
import { SessionKey, SessionKeyScope } from './entities/session-key.entity';
import { CreateSessionKeyDto } from './dto/session-key.dto';

export interface SessionKeyValidationOptions {
  /** Operation being attempted */
  scope: SessionKeyScope;
  /** Amount involved in this transaction (decimal string). Pass '0' for non-financial ops. */
  amount?: string;
}

export interface SessionKeyValidationResult {
  valid: boolean;
  sessionKey: SessionKey;
}

@Injectable()
export class SessionKeyService {
  private readonly logger = new Logger(SessionKeyService.name);

  // Maximum allowed expiry from now: 90 days
  private static readonly MAX_EXPIRY_DAYS = 90;

  constructor(
    @InjectRepository(SessionKey)
    private readonly sessionKeyRepo: Repository<SessionKey>,
    private readonly dataSource: DataSource,
  ) {}

  // ─── CRUD ─────────────────────────────────────────────────────────────────

  /**
   * Register a new session key for the authenticated user.
   */
  async create(userId: string, dto: CreateSessionKeyDto): Promise<SessionKey> {
    const expiresAt = new Date(dto.expiresAt);

    // Expiry must be in the future
    if (expiresAt <= new Date()) {
      throw new BadRequestException('expiresAt must be a future date.');
    }

    // Cap expiry at MAX_EXPIRY_DAYS from now
    const maxExpiry = new Date();
    maxExpiry.setDate(maxExpiry.getDate() + SessionKeyService.MAX_EXPIRY_DAYS);
    if (expiresAt > maxExpiry) {
      throw new BadRequestException(
        `Session key expiry cannot exceed ${SessionKeyService.MAX_EXPIRY_DAYS} days from now.`,
      );
    }

    // Validate spending limits are positive decimals
    if (dto.spendingLimitPerTx !== undefined) {
      this.assertPositiveDecimal(dto.spendingLimitPerTx, 'spendingLimitPerTx');
    }
    if (dto.totalSpendingLimit !== undefined) {
      this.assertPositiveDecimal(dto.totalSpendingLimit, 'totalSpendingLimit');
    }

    // Enforce: per-tx limit cannot exceed total limit
    if (dto.spendingLimitPerTx && dto.totalSpendingLimit) {
      if (
        parseFloat(dto.spendingLimitPerTx) > parseFloat(dto.totalSpendingLimit)
      ) {
        throw new BadRequestException(
          'spendingLimitPerTx cannot exceed totalSpendingLimit.',
        );
      }
    }

    // Unique public key across all users
    const existing = await this.sessionKeyRepo.findOne({
      where: { publicKey: dto.publicKey },
    });
    if (existing) {
      throw new ConflictException(
        'A session key with this public key already exists.',
      );
    }

    const key = this.sessionKeyRepo.create({
      userId,
      publicKey: dto.publicKey,
      expiresAt,
      scope: dto.scope,
      spendingLimitPerTx: dto.spendingLimitPerTx ?? null,
      totalSpendingLimit: dto.totalSpendingLimit ?? null,
      totalSpentAmount: '0',
      label: dto.label ?? null,
      isRevoked: false,
      revokedAt: null,
    });

    const saved = await this.sessionKeyRepo.save(key);
    this.logger.log(
      `Session key created: id=${saved.id} userId=${userId} scope=${dto.scope.join(',')}`,
    );
    return saved;
  }

  /**
   * Revoke a session key. Users may only revoke their own keys.
   */
  async revoke(id: string, userId: string): Promise<void> {
    const key = await this.sessionKeyRepo.findOne({ where: { id } });

    if (!key) {
      throw new NotFoundException(`Session key ${id} not found.`);
    }

    if (key.userId !== userId) {
      throw new ForbiddenException(
        'You may only revoke your own session keys.',
      );
    }

    if (key.isRevoked) {
      throw new BadRequestException('Session key is already revoked.');
    }

    key.isRevoked = true;
    key.revokedAt = new Date();
    await this.sessionKeyRepo.save(key);

    this.logger.log(`Session key revoked: id=${id} userId=${userId}`);
  }

  /**
   * List active (non-revoked, non-expired) session keys for a user.
   * Pass includeRevoked=true to also return revoked/expired keys.
   */
  async list(userId: string, includeRevoked = false): Promise<SessionKey[]> {
    const qb = this.sessionKeyRepo
      .createQueryBuilder('sk')
      .where('sk.userId = :userId', { userId });

    if (!includeRevoked) {
      qb.andWhere('sk.isRevoked = false').andWhere('sk.expiresAt > :now', {
        now: new Date(),
      });
    }

    return qb.orderBy('sk.createdAt', 'DESC').getMany();
  }

  // ─── Validation ───────────────────────────────────────────────────────────

  /**
   * Look up a session key by public key and validate it for the requested scope
   * and amount. Call this before executing any paymaster-submitted transaction.
   *
   * Throws on any policy violation. Returns the validated key on success.
   */
  async validate(
    publicKey: string,
    opts: SessionKeyValidationOptions,
  ): Promise<SessionKeyValidationResult> {
    const key = await this.sessionKeyRepo.findOne({ where: { publicKey } });

    if (!key) {
      throw new ForbiddenException('Session key not found.');
    }

    // Revocation check
    if (key.isRevoked) {
      throw new ForbiddenException('Session key has been revoked.');
    }

    // Expiry check
    if (key.expiresAt <= new Date()) {
      throw new ForbiddenException('Session key has expired.');
    }

    // Scope check
    if (!key.scope.includes(opts.scope)) {
      throw new ForbiddenException(
        `Session key is not authorised for scope '${opts.scope}'. ` +
          `Allowed: ${key.scope.join(', ')}.`,
      );
    }

    // Spending limit checks (only for financial operations with an amount)
    if (opts.amount && parseFloat(opts.amount) > 0) {
      const amount = parseFloat(opts.amount);

      // Per-tx limit
      if (key.spendingLimitPerTx !== null) {
        const perTxLimit = parseFloat(key.spendingLimitPerTx);
        if (amount > perTxLimit) {
          throw new ForbiddenException(
            `Transaction amount (${opts.amount}) exceeds session key per-tx limit (${key.spendingLimitPerTx}).`,
          );
        }
      }

      // Total cumulative limit
      if (key.totalSpendingLimit !== null) {
        const totalLimit = parseFloat(key.totalSpendingLimit);
        const totalSpent = parseFloat(key.totalSpentAmount);
        if (totalSpent + amount > totalLimit) {
          throw new ForbiddenException(
            `Cumulative spending limit reached. ` +
              `Spent: ${key.totalSpentAmount}, Limit: ${key.totalSpendingLimit}.`,
          );
        }
      }
    }

    return { valid: true, sessionKey: key };
  }

  /**
   * Record that a transaction was executed via this session key.
   * Must be called after a successful blockchain operation to update the
   * running total. Uses a row-level lock to prevent race conditions.
   */
  async recordSpend(keyId: string, amount: string): Promise<void> {
    const amountNum = parseFloat(amount);
    if (amountNum <= 0) return;

    await this.dataSource.transaction(async (manager) => {
      const key = await manager
        .createQueryBuilder(SessionKey, 'sk')
        .setLock('pessimistic_write')
        .where('sk.id = :id', { id: keyId })
        .getOne();

      if (!key) return;

      const newTotal = parseFloat(key.totalSpentAmount) + amountNum;
      key.totalSpentAmount = newTotal.toFixed(8);
      await manager.save(SessionKey, key);
    });
  }

  // ─── Cron: auto-expire ────────────────────────────────────────────────────

  /**
   * Runs every hour. Soft-marks expired keys as revoked so queries stay fast.
   * This is belt-and-suspenders — validate() already rejects expired keys.
   */
  @Cron(CronExpression.EVERY_HOUR)
  async expireKeys(): Promise<void> {
    const result = await this.sessionKeyRepo
      .createQueryBuilder()
      .update(SessionKey)
      .set({ isRevoked: true, revokedAt: new Date() })
      .where('expiresAt <= :now', { now: new Date() })
      .andWhere('isRevoked = false')
      .execute();

    if (result.affected && result.affected > 0) {
      this.logger.log(`Auto-expired ${result.affected} session key(s).`);
    }
  }

  // ─── Private helpers ──────────────────────────────────────────────────────

  private assertPositiveDecimal(value: string, field: string): void {
    const n = parseFloat(value);
    if (isNaN(n) || n <= 0) {
      throw new BadRequestException(
        `${field} must be a positive decimal number.`,
      );
    }
  }
}
