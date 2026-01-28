import { Injectable } from '@nestjs/common';

@Injectable()
export class RetryService {
  async shouldRetry(retries: number): Promise<boolean> {
    return retries < 3;
  }
}
