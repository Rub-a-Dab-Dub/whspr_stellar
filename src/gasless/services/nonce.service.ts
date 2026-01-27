import { Injectable } from '@nestjs/common';

@Injectable()
export class NonceService {
  private nonces = new Map<string, number>();

  getNext(userId: string): number {
    const next = (this.nonces.get(userId) ?? 0) + 1;
    this.nonces.set(userId, next);
    return next;
  }
}
