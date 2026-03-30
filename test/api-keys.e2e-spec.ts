import { Test, TestingModule } from '@nestjs/testing';
import { JwtAuthGuard } from '../src/auth/guards/jwt-auth.guard';
import { ApiKeysController } from '../src/api-keys/api-keys.controller';
import { ApiKeysService } from '../src/api-keys/api-keys.service';

describe('ApiKeysController (e2e)', () => {
  let controller: ApiKeysController;
  let service: jest.Mocked<ApiKeysService>;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [ApiKeysController],
      providers: [
        {
          provide: ApiKeysService,
          useValue: {
            createApiKey: jest.fn().mockResolvedValue({
              id: '11111111-1111-1111-1111-111111111111',
              prefix: 'wsk_11111111',
              label: 'CLI key',
              scopes: ['users:read'],
              lastUsedAt: null,
              expiresAt: null,
              revokedAt: null,
              createdAt: new Date('2026-01-01T00:00:00.000Z'),
              key: 'wsk_11111111-1111-1111-1111-111111111111.secret',
            }),
            getApiKeys: jest.fn().mockResolvedValue([
              {
                id: '11111111-1111-1111-1111-111111111111',
                prefix: 'wsk_11111111',
                label: 'CLI key',
                scopes: ['users:read'],
                lastUsedAt: null,
                expiresAt: null,
                revokedAt: null,
                createdAt: new Date('2026-01-01T00:00:00.000Z'),
              },
            ]),
            revokeApiKey: jest.fn().mockResolvedValue(undefined),
            rotateApiKey: jest.fn().mockResolvedValue({
              id: '22222222-2222-2222-2222-222222222222',
              prefix: 'wsk_22222222',
              label: 'CLI key',
              scopes: ['users:read'],
              lastUsedAt: null,
              expiresAt: null,
              revokedAt: null,
              createdAt: new Date('2026-01-02T00:00:00.000Z'),
              key: 'wsk_22222222-2222-2222-2222-222222222222.secret',
            }),
          },
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({
        canActivate: jest.fn().mockReturnValue(true),
      })
      .compile();

    controller = moduleFixture.get(ApiKeysController);
    service = moduleFixture.get(ApiKeysService);
  });

  it('creates an API key and returns the plaintext once', async () => {
    const response = await controller.createApiKey('user-1', {
      label: 'CLI key',
      scopes: ['users:read'],
    });

    expect(response.key).toContain('wsk_');
    expect(service.createApiKey).toHaveBeenCalledWith(
      'user-1',
      expect.objectContaining({ label: 'CLI key' }),
    );
  });

  it('lists API keys without returning plaintext values', async () => {
    const response = await controller.getApiKeys('user-1');

    expect(response).toHaveLength(1);
    expect((response[0] as unknown as { key?: string }).key).toBeUndefined();
  });

  it('revokes an API key', async () => {
    await expect(
      controller.revokeApiKey('user-1', '11111111-1111-1111-1111-111111111111'),
    ).resolves.toEqual({ success: true });

    expect(service.revokeApiKey).toHaveBeenCalledWith(
      'user-1',
      '11111111-1111-1111-1111-111111111111',
    );
  });

  it('rotates an API key and returns a new plaintext key', async () => {
    const response = await controller.rotateApiKey(
      'user-1',
      '11111111-1111-1111-1111-111111111111',
    );

    expect(response.key).toContain('wsk_');
    expect(service.rotateApiKey).toHaveBeenCalledWith(
      'user-1',
      '11111111-1111-1111-1111-111111111111',
    );
  });
});
