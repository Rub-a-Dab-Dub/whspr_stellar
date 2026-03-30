import { ForbiddenException, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { UserTier } from '../users/entities/user.entity';
import { UsersRepository } from '../users/users.repository';
import { ApiKeysRepository } from './api-keys.repository';
import { ApiKeysService } from './api-keys.service';

describe('ApiKeysService', () => {
  let service: ApiKeysService;
  let repository: jest.Mocked<ApiKeysRepository>;
  let usersRepository: jest.Mocked<UsersRepository>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ApiKeysService,
        {
          provide: ApiKeysRepository,
          useValue: {
            create: jest.fn((value) => value),
            save: jest
              .fn()
              .mockImplementationOnce(async (value) => ({
                ...value,
                id: '11111111-1111-1111-1111-111111111111',
                createdAt: new Date('2026-01-01T00:00:00.000Z'),
              }))
              .mockImplementation(async (value) => ({
                ...value,
                createdAt: value.createdAt ?? new Date('2026-01-01T00:00:00.000Z'),
              })),
            findOwnedKey: jest.fn(),
            findActiveById: jest.fn(),
            findByUserId: jest.fn(),
            findOne: jest.fn(),
          },
        },
        {
          provide: UsersRepository,
          useValue: {
            findOne: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get(ApiKeysService);
    repository = module.get(ApiKeysRepository);
    usersRepository = module.get(UsersRepository);
  });

  it('hashes keys deterministically with SHA-256', () => {
    const first = service.hashKey('wsk_test.abc');
    const second = service.hashKey('wsk_test.abc');

    expect(first).toHaveLength(64);
    expect(first).toBe(second);
  });

  it('creates an API key and only returns the plaintext on creation', async () => {
    const created = await service.createApiKey('user-1', {
      label: 'CLI key',
      scopes: ['users:read', 'wallets:read'],
      expiresAt: '2027-01-01T00:00:00.000Z',
    });

    expect(created.key.startsWith('wsk_')).toBe(true);
    expect(created.prefix).toBe('wsk_11111111');
    expect(repository.save).toHaveBeenCalledTimes(2);
  });

  it('validates a stored API key and loads the owning user', async () => {
    const rawKey = 'wsk_11111111-1111-1111-1111-111111111111.secret';
    repository.findActiveById.mockResolvedValue({
      id: '11111111-1111-1111-1111-111111111111',
      userId: 'user-1',
      keyHash: service.hashKey(rawKey),
      prefix: 'wsk_11111111',
      label: 'CLI key',
      scopes: ['users:read'],
      lastUsedAt: null,
      expiresAt: null,
      revokedAt: null,
      createdAt: new Date(),
    });
    usersRepository.findOne.mockResolvedValue({
      id: 'user-1',
      username: 'api-user',
      walletAddress: '0xabc',
      email: null,
      displayName: null,
      avatarUrl: null,
      bio: null,
      preferredLocale: null,
      referralCode: null,
      tier: UserTier.SILVER,
      isActive: true,
      isVerified: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const validated = await service.validateApiKey(rawKey, ['users:read']);

    expect(validated.apiKey.id).toBe('11111111-1111-1111-1111-111111111111');
    expect(validated.user?.id).toBe('user-1');
  });

  it('rejects invalid key hashes', async () => {
    repository.findActiveById.mockResolvedValue({
      id: '11111111-1111-1111-1111-111111111111',
      userId: 'user-1',
      keyHash: service.hashKey('wsk_11111111-1111-1111-1111-111111111111.other'),
      prefix: 'wsk_11111111',
      label: 'CLI key',
      scopes: ['users:read'],
      lastUsedAt: null,
      expiresAt: null,
      revokedAt: null,
      createdAt: new Date(),
    });

    await expect(
      service.validateApiKey('wsk_11111111-1111-1111-1111-111111111111.secret'),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('rejects missing scopes', async () => {
    const rawKey = 'wsk_11111111-1111-1111-1111-111111111111.secret';
    repository.findActiveById.mockResolvedValue({
      id: '11111111-1111-1111-1111-111111111111',
      userId: 'user-1',
      keyHash: service.hashKey(rawKey),
      prefix: 'wsk_11111111',
      label: 'CLI key',
      scopes: ['users:read'],
      lastUsedAt: null,
      expiresAt: null,
      revokedAt: null,
      createdAt: new Date(),
    });

    await expect(service.validateApiKey(rawKey, ['wallets:write'])).rejects.toThrow(
      ForbiddenException,
    );
  });

  it('revokes owned keys and fails for missing ones', async () => {
    repository.findOwnedKey.mockResolvedValueOnce({
      id: 'key-1',
      userId: 'user-1',
      keyHash: 'hash',
      prefix: 'wsk_key',
      label: 'CLI key',
      scopes: ['users:read'],
      lastUsedAt: null,
      expiresAt: null,
      revokedAt: null,
      createdAt: new Date(),
    });

    await service.revokeApiKey('user-1', 'key-1');
    expect(repository.save).toHaveBeenCalled();

    repository.findOwnedKey.mockResolvedValueOnce(null);
    await expect(service.revokeApiKey('user-1', 'missing')).rejects.toThrow(NotFoundException);
  });
});
