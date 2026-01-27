import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { SessionKey } from './session-key.entity';

@Injectable()
export class SessionKeyService {
  constructor(
    @InjectRepository(SessionKey)
    private readonly repo: Repository<SessionKey>,
  ) {}

  async validate(userId: string, publicKey: string): Promise<boolean> {
    const key = await this.repo.findOne({
      where: { userId, publicKey, revoked: false },
    });

    return !!key && key.expiresAt > new Date();
  }
}
