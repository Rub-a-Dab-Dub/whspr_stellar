import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ReputationScore } from './entities/reputation-score.entity';
import { UserRating } from './entities/user-rating.entity';

@Injectable()
export class ReputationRepository {
  constructor(
    @InjectRepository(ReputationScore)
    private readonly scoreRepo: Repository<ReputationScore>,
    @InjectRepository(UserRating)
    private readonly ratingRepo: Repository<UserRating>,
  ) {}

  // ── ReputationScore ──────────────────────────────────────────────────────

  async findScoreByUserId(userId: string): Promise<ReputationScore | null> {
    return this.scoreRepo.findOne({ where: { userId } });
  }

  async upsertScore(userId: string, partial: Partial<ReputationScore>): Promise<ReputationScore> {
    let record = await this.findScoreByUserId(userId);
    if (!record) {
      record = this.scoreRepo.create({ userId, ...partial });
    } else {
      Object.assign(record, partial);
    }
    return this.scoreRepo.save(record);
  }

  async saveScore(record: ReputationScore): Promise<ReputationScore> {
    return this.scoreRepo.save(record);
  }

  // ── UserRating ────────────────────────────────────────────────────────────

  async findExistingRating(raterId: string, conversationId: string): Promise<UserRating | null> {
    return this.ratingRepo.findOne({ where: { raterId, conversationId } });
  }

  async createRating(data: Partial<UserRating>): Promise<UserRating> {
    const rating = this.ratingRepo.create(data);
    return this.ratingRepo.save(rating);
  }

  async findRatingsForUser(ratedUserId: string): Promise<UserRating[]> {
    return this.ratingRepo.find({ where: { ratedUserId }, order: { createdAt: 'DESC' } });
  }
}
