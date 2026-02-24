import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-jwt';
import { AdminApiKeysService } from 'src/admin/services/admin-api-keys.service';

@Injectable()
export class AdminApiKeyStrategy extends PassportStrategy(
  Strategy,
  'admin-api-key',
) {
  constructor(private readonly apiKeyService: AdminApiKeysService) {
    super();
  }

  async validate(req: Request) {
    const header = req.headers['authorization'];

    if (!header || !header.startsWith('ApiKey ')) return null;

    const rawKey = header.replace('ApiKey ', '').trim();

    const key = await this.apiKeyService.validateKey(rawKey);

    if (!key) return null;

    return key.admin;
  }
}
