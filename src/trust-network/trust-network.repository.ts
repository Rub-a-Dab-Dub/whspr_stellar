import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Vouch } from './entities/vouch.entity';
import { TrustScore } from './entities/trust-score.entity';

@Injectable()
export class TrustNetworkRepository {
  constructor(
    @InjectRepository(Vouch)
    private vouchRepo: Repository<Vouch>,
    @InjectRepository(TrustScore)
    private trustScoreRepo: Repository<TrustScore>,
  ) {}

  async createVouch(vouchData: Partial<Vouch>): Promise<Vouch> {
    const vouch = this.vouchRepo.create(vouchData);
    return this.vouchRepo.save(vouch);
  }

  async findVouch(voucherId: string, vouchedId: string): Promise<Vouch | null> {
    return this.vouchRepo.findOne({ where: { voucherId, vouchedId } });
  }

  async revokeVouch(vouchId: string): Promise<Vouch> {
    const vouch = await this.vouchRepo.findOneBy({ id: vouchId });
    if (!vouch) throw new Error('Vouch not found');
    vouch.isRevoked = true;
    vouch.revokedAt = new Date();
    return this.vouchRepo.save(vouch);
  }

  async getVouchersForUser(userId: string): Promise<Vouch[]> {
    return this.vouchRepo.find({ where: { voucherId: userId } });
  }

  async getVouchedForUser(userId: string): Promise<Vouch[]> {
    return this.vouchRepo.find({ where: { vouchedId: userId } });
  }

  async findTrustScore(userId: string): Promise<TrustScore | null> {
    return this.trustScoreRepo.findOne({ where: { userId } });
  }

  async upsertTrustScore(scoreData: Partial<TrustScore>): Promise<TrustScore> {
    let score = await this.findTrustScore(scoreData.userId!);
    if (!score) {
      score = this.trustScoreRepo.create(scoreData as TrustScore);
    } else {
      Object.assign(score, scoreData);
    }
    score.calculatedAt = new Date();
    return this.trustScoreRepo.save(score);
  }

  /**
   * Get direct incoming vouches for transitive computation.
   */
  async getIncomingVouches(userId: string): Promise<Vouch[]> {
    return this.vouchRepo.find({
      where: { vouchedId: userId, isRevoked: false },
      relations: ['voucher'],
    });
  }

  /**
   * Get users at hop distance (for BFS).
   */
  async getVouchedUsers(userIds: string[]): Promise<{ userId: string; score: number }[]> {
    if (userIds.length === 0) return [];
    const vouches = await this.vouchRepo.find({
      where: { voucherId: In(userIds), isRevoked: false },
    });
    return vouches.map(v => ({ userId: v.vouchedId, score: Number(v.trustScore) }));
  }
}
