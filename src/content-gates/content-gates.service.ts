import {
  Injectable,
  Logger,
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { StrKey } from '@stellar/stellar-sdk';
import { CacheService } from '../cache/cache.service';
import { HorizonService } from '../wallets/services/horizon.service';
import { UsersRepository } from '../users/users.repository';
import { UserTier } from '../users/entities/user.entity';
import {
  ContentGate,
  GatedContentType,
  GateType,
} from './entities/content-gate.entity';
import { CreateContentGateDto } from './dto/create-content-gate.dto';
import { VerifyContentGateDto } from './dto/verify-content-gate.dto';
import { parseGateAsset } from './utils/gate-asset.util';
import { parseUserTier, userMeetsMinTier } from './utils/staking-tier.util';
import { ContentGateRequiredException } from './exceptions/content-gate-required.exception';
import { GateRequirementSummary } from './content-gates.types';
import { WalletNetwork } from '../wallets/entities/wallet.entity';

const VERIFY_CACHE_PREFIX = 'content-gate:v1:gate';
const VERIFY_CACHE_TTL_SEC = 300;

@Injectable()
export class ContentGatesService {
  private readonly logger = new Logger(ContentGatesService.name);

  constructor(
    @InjectRepository(ContentGate)
    private readonly gateRepo: Repository<ContentGate>,
    private readonly cache: CacheService,
    private readonly horizon: HorizonService,
    private readonly users: UsersRepository,
  ) {}

  toSummary(gate: ContentGate): GateRequirementSummary {
    return {
      id: gate.id,
      contentType: gate.contentType,
      contentId: gate.contentId,
      gateType: gate.gateType,
      gateToken: gate.gateToken,
      minBalance: gate.minBalance,
      network: gate.network,
    };
  }

  async createGate(userId: string, dto: CreateContentGateDto): Promise<ContentGate> {
    this.validateGatePayload(dto);

    const gate = this.gateRepo.create({
      contentType: dto.contentType,
      contentId: dto.contentId.trim(),
      createdBy: userId,
      gateType: dto.gateType,
      gateToken: dto.gateToken.trim(),
      minBalance: dto.minBalance?.trim() || '0',
      network: dto.network ?? WalletNetwork.STELLAR_MAINNET,
      isActive: true,
    });
    return this.gateRepo.save(gate);
  }

  async removeGate(gateId: string, userId: string): Promise<void> {
    const gate = await this.gateRepo.findOne({ where: { id: gateId } });
    if (!gate) {
      throw new NotFoundException('Content gate not found');
    }
    if (gate.createdBy !== userId) {
      throw new ForbiddenException('Only the creator can remove this gate');
    }
    gate.isActive = false;
    await this.gateRepo.save(gate);
    await this.invalidateGateVerificationCache(gateId);
  }

  async getGatedContent(
    contentType: GatedContentType,
    contentId: string,
  ): Promise<GateRequirementSummary[]> {
    const gates = await this.gateRepo.find({
      where: { contentType, contentId: contentId.trim(), isActive: true },
      order: { createdAt: 'ASC' },
    });
    return gates.map((g) => this.toSummary(g));
  }

  /**
   * Stores a verification outcome in Redis (5 min TTL). Used for testing/admin flows;
   * normal verifies populate cache automatically.
   */
  async cacheVerification(gateId: string, userId: string, allowed: boolean): Promise<void> {
    await this.cache.set(this.verifyCacheKey(gateId, userId), { allowed }, VERIFY_CACHE_TTL_SEC);
  }

  async verifyAccess(
    userId: string,
    contentType: GatedContentType,
    contentId: string,
  ): Promise<{ allowed: boolean; gates: GateRequirementSummary[] }> {
    const gates = await this.gateRepo.find({
      where: { contentType, contentId: contentId.trim(), isActive: true },
    });
    if (gates.length === 0) {
      return { allowed: true, gates: [] };
    }

    const failed: GateRequirementSummary[] = [];
    for (const gate of gates) {
      const ok = await this.verifyGateForUserCached(gate, userId);
      if (!ok) {
        failed.push(this.toSummary(gate));
      }
    }

    return {
      allowed: failed.length === 0,
      gates: failed.length === 0 ? [] : failed,
    };
  }

  async assertAccessOr402(userId: string, dto: VerifyContentGateDto): Promise<void> {
    const { allowed } = await this.verifyAccess(userId, dto.contentType, dto.contentId);
    if (!allowed) {
      const all = await this.getGatedContent(dto.contentType, dto.contentId);
      throw new ContentGateRequiredException(all);
    }
  }

  async batchVerify(
    userId: string,
    items: VerifyContentGateDto[],
  ): Promise<{ contentType: GatedContentType; contentId: string; allowed: boolean }[]> {
    const slice = items.slice(0, 50);
    const results = await Promise.all(
      slice.map(async (item) => {
        const { allowed } = await this.verifyAccess(userId, item.contentType, item.contentId);
        return {
          contentType: item.contentType,
          contentId: item.contentId,
          allowed,
        };
      }),
    );
    return results;
  }

  private validateGatePayload(dto: CreateContentGateDto): void {
    if (dto.gateType === GateType.STAKING_TIER) {
      if (!parseUserTier(dto.gateToken)) {
        throw new BadRequestException(
          'gateToken must be a user tier: silver, gold, or black for STAKING_TIER gates',
        );
      }
      return;
    }
    const parsed = parseGateAsset(dto.gateToken);
    if (!parsed) {
      throw new BadRequestException(
        'gateToken must be native, XLM, or CODE:ISSUER for token/NFT gates',
      );
    }
  }

  private verifyCacheKey(gateId: string, userId: string): string {
    return `${VERIFY_CACHE_PREFIX}:${gateId}:user:${userId}`;
  }

  private async verifyGateForUserCached(gate: ContentGate, userId: string): Promise<boolean> {
    const key = this.verifyCacheKey(gate.id, userId);
    const hit = await this.cache.get<{ allowed: boolean }>(key);
    if (hit !== null) {
      return hit.allowed;
    }
    const allowed = await this.verifyGateForUser(gate, userId);
    await this.cache.set(key, { allowed }, VERIFY_CACHE_TTL_SEC);
    return allowed;
  }

  private async verifyGateForUser(gate: ContentGate, userId: string): Promise<boolean> {
    const user = await this.users.findOne({ where: { id: userId } });
    if (!user) {
      return false;
    }

    if (gate.gateType === GateType.STAKING_TIER) {
      const required = parseUserTier(gate.gateToken);
      if (!required) return false;
      return userMeetsMinTier(user.tier, required);
    }

    const wallet = user.walletAddress?.trim() ?? '';
    if (!StrKey.isValidEd25519PublicKey(wallet)) {
      this.logger.debug(`User ${userId} has no valid Stellar public key for Horizon gate`);
      return false;
    }

    const balances = await this.horizon.getBalancesOrEmpty(wallet, gate.network);
    const parsed = parseGateAsset(gate.gateToken);
    if (!parsed) {
      return false;
    }

    const min = parseFloat(gate.minBalance || '0');
    const threshold =
      gate.gateType === GateType.NFT ? Math.max(min, 1) : min;

    if (parsed.kind === 'native') {
      const native = balances.find((b) => b.assetCode === 'XLM' && b.assetType === 'native');
      const bal = native ? parseFloat(native.balance) : 0;
      return bal >= threshold;
    }

    const line = balances.find(
      (b) =>
        b.assetIssuer &&
        b.assetIssuer === parsed.issuer &&
        b.assetCode?.toUpperCase() === parsed.code.toUpperCase(),
    );
    if (!line) {
      return false;
    }
    const bal = parseFloat(line.balance);
    return bal >= threshold;
  }

  async invalidateGateVerificationCache(gateId: string): Promise<void> {
    await this.cache.invalidatePattern(`${VERIFY_CACHE_PREFIX}:${gateId}:user:*`);
  }
}
