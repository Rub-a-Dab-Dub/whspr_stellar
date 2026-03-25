import { Injectable, Logger } from '@nestjs/common';
import { createHash } from 'crypto';

@Injectable()
export class SorobanService {
  private readonly logger = new Logger(SorobanService.name);

  async submitMessageHash(messageId: string, plaintextContent: string): Promise<void> {
    // Simulate asynchronous submission to Soroban smart contract.
    const hash = createHash('sha256').update(plaintextContent).digest('hex');
    await new Promise((resolve) => setTimeout(resolve, 10)); // mimic async I/O
    this.logger.log(`Submitted hash for message ${messageId}: ${hash}`);
  }
}
