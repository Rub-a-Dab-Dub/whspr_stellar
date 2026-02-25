import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { User } from '../user/entities/user.entity';
import { XpTransaction, XpReason } from './entities/xp-transaction.entity';
import { XpGateway } from './gateways/xp.gateway';
import { XP_RULES, xpToLevel } from './xp.constants';

export interface AwardResult {
  xpAwarded: number;
  xpTotal: number;
  previousLevel: number;
  currentLevel: number;
  leveledUp: boolean;
  transaction: XpTransaction;
}

@Injectable()
export class UserXpService {
  private readonly logger = new Logger(UserXpService.name);

  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(XpTransaction)
    private readonly xpTxRepo: Repository<XpTransaction>,
    private readonly xpGateway: XpGateway,
    private readonly dataSource: DataSource,
  ) {}

  // ─── Public API ───────────────────────────────────────────────────────────

  /**
   * Award XP for a fixed-rule action (send_message, create_room, etc.).
   * The XP amount is resolved from XP_RULES automatically.
   *
   * For variable-amount actions (quest_complete, admin_grant) use awardVariable().
   */
  async award(
    userId: string,
    reason: XpReason,
    meta?: string,
  ): Promise<AwardResult> {
    const amount = XP_RULES[reason];
    if (
      amount <= 0 &&
      reason !== XpReason.ADMIN_GRANT &&
      reason !== XpReason.QUEST_COMPLETE
    ) {
      this.logger.warn(
        `award() called for reason=${reason} which resolves to 0 XP — skipping`,
      );
      throw new Error(
        `Use awardVariable() for variable-amount reasons like ${reason}.`,
      );
    }
    return this.applyAward(userId, amount, reason, meta);
  }

  /**
   * Award a variable XP amount (quests, admin grants, etc.).
   */
  async awardVariable(
    userId: string,
    xp: number,
    reason: XpReason,
    meta?: string,
  ): Promise<AwardResult> {
    if (xp <= 0) throw new Error('XP amount must be positive.');
    return this.applyAward(userId, xp, reason, meta);
  }

  // ─── XP History ───────────────────────────────────────────────────────────

  async getHistory(
    userId: string,
    limit = 20,
    offset = 0,
  ): Promise<{
    transactions: XpTransaction[];
    total: number;
    xpTotal: number;
    level: number;
  }> {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException(`User ${userId} not found`);

    const [transactions, total] = await this.xpTxRepo.findAndCount({
      where: { userId },
      order: { createdAt: 'DESC' },
      take: limit,
      skip: offset,
    });

    return { transactions, total, xpTotal: user.xpTotal, level: user.level };
  }

  // ─── Internal ─────────────────────────────────────────────────────────────

  private async applyAward(
    userId: string,
    amount: number,
    reason: XpReason,
    meta?: string,
  ): Promise<AwardResult> {
    return this.dataSource.transaction(async (manager) => {
      // 1. Lock the user row for update to avoid race conditions
      const user = await manager
        .createQueryBuilder(User, 'u')
        .setLock('pessimistic_write')
        .where('u.id = :id', { id: userId })
        .getOne();

      if (!user) throw new NotFoundException(`User ${userId} not found`);

      const previousLevel = user.level;
      const previousXp = user.xpTotal;

      // 2. Apply XP
      user.xpTotal += amount;
      const newLevel = xpToLevel(user.xpTotal);
      user.level = newLevel;
      await manager.save(User, user);

      // 3. Persist transaction log
      const tx = manager.create(XpTransaction, {
        userId,
        amount,
        reason,
        meta: meta ?? null,
        xpAfter: user.xpTotal,
        levelAfter: newLevel,
      });
      await manager.save(XpTransaction, tx);

      this.logger.debug(
        `XP awarded: userId=${userId} +${amount} (${reason}) ` +
          `xp=${previousXp}→${user.xpTotal} level=${previousLevel}→${newLevel}`,
      );

      // 4. Emit level-up WebSocket event if level changed
      const leveledUp = newLevel > previousLevel;
      if (leveledUp) {
        // Fire-and-forget outside the transaction — gateway is non-critical
        setImmediate(() =>
          this.xpGateway.emitLevelUp({
            userId,
            previousLevel,
            newLevel,
            xpTotal: user.xpTotal,
            reason,
          }),
        );
      }

      return {
        xpAwarded: amount,
        xpTotal: user.xpTotal,
        previousLevel,
        currentLevel: newLevel,
        leveledUp,
        transaction: tx,
      };
    });
  }
}
