import { Injectable, Logger } from '@nestjs/common';
import { SorobanClientService } from '../soroban-client/soroban-client.service';

@Injectable()
export class ReputationContractService {
  private readonly logger = new Logger(ReputationContractService.name);

  constructor(private readonly sorobanClient: SorobanClientService) {}

  async setTrustScore(userId: string, score: number): Promise<string> {
    this.logger.log(`Setting on-chain trust score ${score} for ${userId}`);
    // Call whsper_stellar set_trust_score(userId, score as u32)
    // Similar to other contract services
    // return this.sorobanClient.callFunction('set_trust_score', userId, score);
    return 'tx-hash-stub'; // stub for now
  }

  async getTrustScore(userId: string): Promise<number> {
    this.logger.log(`Getting on-chain trust score for ${userId}`);
    // call view get_trust_score(userId)
    return 3.5; // stub
  }
}
