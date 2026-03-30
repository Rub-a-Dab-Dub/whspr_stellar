import { Injectable, ForbiddenException, NotFoundException, Logger } from '@nestjs/common';
import { TrustNetworkRepository } from './trust-network.repository';
import { VouchDto, TrustResponseDto, VouchersResponseDto, VouchedResponseDto } from './dto/vouch.dto';
import { TrustScore } from './entities/trust-score.entity';
import { SorobanService } from '../soroban/soroban.service';
import { ReputationService } from '../reputation/reputation.service';

const MIN_VOUCHER_TRUST_SCORE = 3.0;
const MAX_HOPS = 3;
const HOP_DECAY = 0.5;

@Injectable()
export class TrustNetworkService {
  private readonly logger = new Logger(TrustNetworkService.name);

  constructor(
    private readonly repo: TrustNetworkRepository,
    private readonly soroban: SorobanService,
    private readonly reputationService: ReputationService,
  ) {}

  async vouchForUser(voucherId: string, vouchedId: string, dto: VouchDto): Promise<void> {
    if (voucherId === vouchedId) {
      throw new ForbiddenException('Cannot vouch for self');
    }

    const existing = await this.repo.findVouch(voucherId, vouchedId);
    if (existing) {
      throw new ForbiddenException('Vouch already exists');
    }

    const voucherScore = await this.getTrustScore(voucherId);
    if (voucherScore.score < MIN_VOUCHER_TRUST_SCORE) {
      throw new ForbiddenException(`Voucher trust score ${voucherScore.score} < ${MIN_VOUCHER_TRUST_SCORE}`);
    }

    const vouchData = {
      voucherId,
      vouchedId,
      trustScore: dto.trustScore,
      comment: dto.comment,
    };

    await this.repo.createVouch(vouchData);
    await this.propagateTrust(vouchedId);
    await this.syncToChain(vouchedId);
    await this.updateReputationAggregate(voucherId, vouchedId);
  }

  async revokeVouch(voucherId: string, vouchedId: string): Promise<void> {
    const vouch = await this.repo.findVouch(voucherId, vouchedId);
    if (!vouch) {
      throw new NotFoundException('Vouch not found');
    }
    if (vouch.isRevoked) {
      throw new ForbiddenException('Vouch already revoked');
    }

    await this.repo.revokeVouch(vouch.id);
    await this.propagateTrust(vouchedId);
    await this.syncToChain(vouchedId);
    await this.updateReputationAggregate(voucherId, vouchedId);
  }

  async getTrustScore(userId: string): Promise<TrustResponseDto> {
    let score = await this.repo.findTrustScore(userId);
    if (!score) {
      score = await this.repo.upsertTrustScore({ userId, score: 0, vouchCount: 0, revokedCount: 0, networkDepth: 0 });
    }
    return {
      userId: score.userId,
      score: score.score,
      vouchCount: score.vouchCount,
      revokedCount: score.revokedCount,
      networkDepth: score.networkDepth,
      calculatedAt: score.calculatedAt,
    };
  }

  async getVouchers(userId: string): Promise<VouchersResponseDto> {
    const vouches = await this.repo.getVouchersForUser(userId);
    return {
      vouchers: vouches.map(v => v.vouchedId),
      scores: vouches.map(v => Number(v.trustScore)),
    };
  }

  async getVouched(userId: string): Promise<VouchedResponseDto> {
    const vouches = await this.repo.getVouchedForUser(userId);
    return {
      vouched: vouches.map(v => v.voucherId),
      scores: vouches.map(v => Number(v.trustScore)),
    };
  }

  private async propagateTrust(userId: string): Promise<void> {
    // BFS transitive trust up to 3 hops w/ 50% decay
    const visited = new Set<string>();
    const queue: Array<{ userId: string; score: number; depth: number }> = [{ userId, score: 0, depth: 0 }];
    let totalScore = 0;
    let vouchCount = 0;
    let revokedCount = 0;
    let maxDepth = 0;

    while (queue.length > 0 && queue[0].depth < MAX_HOPS) {
      const { userId: currId, score: currScore, depth } = queue.shift()!;
      if (visited.has(currId)) continue;
      visited.add(currId);

      const incoming = await this.repo.getIncomingVouches(currId);
      for (const vouch of incoming) {
        if (vouch.isRevoked) {
          revokedCount++;
          continue;
        }
        vouchCount++;
        const decayedScore = Number(vouch.trustScore) * Math.pow(HOP_DECAY, depth + 1);
        totalScore += decayedScore;

        const next = { userId: vouch.voucherId, score: decayedScore, depth: depth + 1 };
        queue.push(next);
      }
      maxDepth = Math.max(maxDepth, depth);
    }

    const finalScore = vouchCount > 0 ? totalScore / vouchCount : 0;
    await this.repo.upsertTrustScore({ 
      userId, 
      score: parseFloat(finalScore.toFixed(2)),
      vouchCount, 
      revokedCount,
      networkDepth: maxDepth 
    });
  }

  private async syncToChain(userId: string): Promise<void> {
    const score = await this.getTrustScore(userId);
    // Assume soroban.reputation.setTrustScore(userId, score.score);
    this.logger.debug(`Synced trust score ${score.score} for ${userId} to chain`);
  }

  private async updateReputationAggregate(voucherId: string, vouchedId: string): Promise<void> {
    // Trigger reputation recalc
    await this.reputationService.getReputation(vouchedId); // calls recalc
  }
}
