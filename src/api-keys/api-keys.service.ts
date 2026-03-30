import { randomBytes, createHash, timingSafeEqual } from 'crypto';
import {
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { UsersRepository } from '../users/users.repository';
import { API_KEY_PREFIX } from './constants';
import { CreateApiKeyDto } from './dto/create-api-key.dto';
import { CreatedApiKeyResponseDto, ApiKeyResponseDto } from './dto/api-key-response.dto';
import { ApiKey } from './entities/api-key.entity';
import { ApiKeysRepository } from './api-keys.repository';

export interface ValidatedApiKey {
  apiKey: ApiKey;
  user: Awaited<ReturnType<UsersRepository['findOne']>>;
}

@Injectable()
export class ApiKeysService {
  constructor(
    private readonly apiKeysRepository: ApiKeysRepository,
    private readonly usersRepository: UsersRepository,
  ) {}

  async createApiKey(userId: string, dto: CreateApiKeyDto): Promise<CreatedApiKeyResponseDto> {
    const keyRecord = this.apiKeysRepository.create({
      userId,
      keyHash: '',
      prefix: '',
      label: dto.label,
      scopes: [...new Set(dto.scopes)].sort(),
      expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null,
      lastUsedAt: null,
      revokedAt: null,
    });

    const persisted = await this.apiKeysRepository.save(keyRecord);
    const secret = randomBytes(24).toString('hex');
    const rawKey = `${API_KEY_PREFIX}${persisted.id}.${secret}`;
    persisted.keyHash = this.hashKey(rawKey);
    persisted.prefix = `${API_KEY_PREFIX}${persisted.id.slice(0, 8)}`;

    const saved = await this.apiKeysRepository.save(persisted);
    return {
      ...this.toResponse(saved),
      key: rawKey,
    };
  }

  async revokeApiKey(userId: string, id: string): Promise<void> {
    const apiKey = await this.apiKeysRepository.findOwnedKey(userId, id);
    if (!apiKey) {
      throw new NotFoundException(`API key ${id} not found`);
    }

    if (!apiKey.revokedAt) {
      apiKey.revokedAt = new Date();
      await this.apiKeysRepository.save(apiKey);
    }
  }

  async rotateApiKey(userId: string, id: string): Promise<CreatedApiKeyResponseDto> {
    const current = await this.apiKeysRepository.findOwnedKey(userId, id);
    if (!current) {
      throw new NotFoundException(`API key ${id} not found`);
    }

    await this.revokeApiKey(userId, id);
    return this.createApiKey(userId, {
      label: current.label,
      scopes: current.scopes,
      expiresAt: current.expiresAt?.toISOString(),
    });
  }

  async validateApiKey(rawKey: string, requiredScopes: string[] = []): Promise<ValidatedApiKey> {
    const id = this.extractId(rawKey);
    const apiKey = await this.apiKeysRepository.findActiveById(id);
    if (!apiKey) {
      throw new UnauthorizedException('Invalid API key');
    }

    const providedHash = this.hashKey(rawKey);
    const stored = Buffer.from(apiKey.keyHash, 'hex');
    const provided = Buffer.from(providedHash, 'hex');
    if (stored.length !== provided.length || !timingSafeEqual(stored, provided)) {
      throw new UnauthorizedException('Invalid API key');
    }

    if (
      requiredScopes.length > 0 &&
      !requiredScopes.every((scope) => apiKey.scopes.includes(scope))
    ) {
      throw new ForbiddenException('API key does not include the required scopes');
    }

    const user = await this.usersRepository.findOne({ where: { id: apiKey.userId } });
    if (!user || !user.isActive) {
      throw new UnauthorizedException('API key user is not available');
    }

    return { apiKey, user };
  }

  async getApiKeys(userId: string): Promise<ApiKeyResponseDto[]> {
    const apiKeys = await this.apiKeysRepository.findByUserId(userId);
    return apiKeys.map((apiKey) => this.toResponse(apiKey));
  }

  async trackUsage(id: string): Promise<void> {
    const apiKey = await this.apiKeysRepository.findOne({ where: { id } });
    if (!apiKey) {
      return;
    }

    apiKey.lastUsedAt = new Date();
    await this.apiKeysRepository.save(apiKey);
  }

  hashKey(rawKey: string): string {
    return createHash('sha256').update(rawKey).digest('hex');
  }

  private extractId(rawKey: string): string {
    if (!rawKey.startsWith(API_KEY_PREFIX)) {
      throw new UnauthorizedException('Invalid API key');
    }

    const withoutPrefix = rawKey.slice(API_KEY_PREFIX.length);
    const [id] = withoutPrefix.split('.');
    if (!id) {
      throw new UnauthorizedException('Invalid API key');
    }

    return id;
  }

  private toResponse(apiKey: ApiKey): ApiKeyResponseDto {
    return {
      id: apiKey.id,
      prefix: apiKey.prefix,
      label: apiKey.label,
      scopes: apiKey.scopes,
      lastUsedAt: apiKey.lastUsedAt,
      expiresAt: apiKey.expiresAt,
      revokedAt: apiKey.revokedAt,
      createdAt: apiKey.createdAt,
    };
  }
}
