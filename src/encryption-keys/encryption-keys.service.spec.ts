import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, ConflictException } from '@nestjs/common';
import { EncryptionKeysService } from './encryption-keys.service';
import { EncryptionKeysRepository } from './encryption-keys.repository';
import { PreKeyBundlesRepository } from './pre-key-bundles.repository';
import { SorobanKeyRegistryService } from './soroban-key-registry.service';
import { EncryptionKey, KeyType } from './entities/encryption-key.entity';
import { PreKeyBundle } from './entities/pre-key-bundle.entity';
import { RegisterKeyDto } from './dto/register-key.dto';
import { RotateKeyDto } from './dto/rotate-key.dto';

const USER_ID = 'user-uuid-1111-1111-111111111111';
const KEY_ID = 'key-uuid-2222-2222-222222222222';
const BUNDLE_ID = 'bundle-uuid-3333-3333-333333333333';
const PUBLIC_KEY = 'base64encodedpublickey==';
const PUBLIC_KEY_2 = 'base64encodedpublickey2==';

const makeKey = (overrides: Partial<EncryptionKey> = {}): EncryptionKey =>
  ({
    id: KEY_ID,
    userId: USER_ID,
    publicKey: PUBLIC_KEY,
    keyType: KeyType.X25519,
    version: 1,
    isActive: true,
    registeredOnChain: false,
    createdAt: new Date('2024-01-01'),
    user: {} as any,
    ...overrides,
  } as EncryptionKey);

const makeBundle = (overrides: Partial<PreKeyBundle> = {}): PreKeyBundle =>
  ({
    id: BUNDLE_ID,
    userId: USER_ID,
    encryptionKeyId: KEY_ID,
    preKeys: [{ keyId: 1, publicKey: 'prekey1==' }],
    isValid: true,
    createdAt: new Date('2024-01-01'),
    encryptionKey: {} as any,
    ...overrides,
  } as PreKeyBundle);

describe('EncryptionKeysService', () => {
  let service: EncryptionKeysService;
  let keysRepo: jest.Mocked<EncryptionKeysRepository>;
  let bundlesRepo: jest.Mocked<PreKeyBundlesRepository>;
  let soroban: jest.Mocked<SorobanKeyRegistryService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EncryptionKeysService,
        {
          provide: EncryptionKeysRepository,
          useValue: {
            findActiveByUserId: jest.fn(),
            findByUserId: jest.fn(),
            findByUserAndId: jest.fn(),
            findNextVersion: jest.fn(),
            findPendingChainSync: jest.fn(),
            findOne: jest.fn(),
            rotateKeys: jest.fn(),
            create: jest.fn(),
            save: jest.fn(),
          },
        },
        {
          provide: PreKeyBundlesRepository,
          useValue: {
            findValidByUserId: jest.fn(),
            findByEncryptionKeyId: jest.fn(),
            invalidateByUserId: jest.fn(),
            create: jest.fn(),
            save: jest.fn(),
          },
        },
        {
          provide: SorobanKeyRegistryService,
          useValue: {
            registerKey: jest.fn().mockResolvedValue(false),
            revokeKey: jest.fn().mockResolvedValue(false),
          },
        },
      ],
    }).compile();

    service = module.get(EncryptionKeysService);
    keysRepo = module.get(EncryptionKeysRepository);
    bundlesRepo = module.get(PreKeyBundlesRepository);
    soroban = module.get(SorobanKeyRegistryService);

    jest.clearAllMocks();
  });

  // ─── registerKey ──────────────────────────────────────────────────────────

  describe('registerKey', () => {
    const dto: RegisterKeyDto = { publicKey: PUBLIC_KEY, keyType: KeyType.X25519 };

    beforeEach(() => {
      keysRepo.findActiveByUserId.mockResolvedValue(null);
      keysRepo.create.mockReturnValue(makeKey());
      keysRepo.save.mockResolvedValue(makeKey());
    });

    it('creates a new key with version 1 when no active key exists', async () => {
      const result = await service.registerKey(USER_ID, dto);
      expect(result.version).toBe(1);
      expect(result.isActive).toBe(true);
      expect(keysRepo.save).toHaveBeenCalled();
    });

    it('throws ConflictException when an active key already exists', async () => {
      keysRepo.findActiveByUserId.mockResolvedValue(makeKey());
      await expect(service.registerKey(USER_ID, dto)).rejects.toThrow(ConflictException);
      expect(keysRepo.save).not.toHaveBeenCalled();
    });

    it('saves a prekey bundle when preKeys are provided', async () => {
      const preKeys = [{ keyId: 1, publicKey: 'prekey1==' }];
      bundlesRepo.create.mockReturnValue(makeBundle());
      bundlesRepo.save.mockResolvedValue(makeBundle());

      await service.registerKey(USER_ID, { ...dto, preKeys });

      expect(bundlesRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ userId: USER_ID, preKeys }),
      );
      expect(bundlesRepo.save).toHaveBeenCalled();
    });

    it('does not save a prekey bundle when none provided', async () => {
      await service.registerKey(USER_ID, dto);
      expect(bundlesRepo.save).not.toHaveBeenCalled();
    });

    it('triggers background chain sync after registration', async () => {
      keysRepo.findOne.mockResolvedValue(makeKey());
      soroban.registerKey.mockResolvedValue(true);
      keysRepo.save.mockResolvedValue(makeKey({ registeredOnChain: true }));

      await service.registerKey(USER_ID, dto);

      // Allow microtask queue to process background sync
      await new Promise((resolve) => setImmediate(resolve));
      expect(soroban.registerKey).toHaveBeenCalled();
    });

    it('returns EncryptionKeyResponseDto with correct shape', async () => {
      const result = await service.registerKey(USER_ID, dto);
      expect(result).toHaveProperty('id');
      expect(result).toHaveProperty('userId', USER_ID);
      expect(result).toHaveProperty('publicKey', PUBLIC_KEY);
      expect(result).toHaveProperty('keyType', KeyType.X25519);
      expect(result).toHaveProperty('version');
      expect(result).toHaveProperty('isActive');
      expect(result).toHaveProperty('registeredOnChain');
      expect(result).toHaveProperty('createdAt');
    });
  });

  // ─── rotateKey ────────────────────────────────────────────────────────────

  describe('rotateKey', () => {
    const dto: RotateKeyDto = { publicKey: PUBLIC_KEY_2, keyType: KeyType.ED25519 };
    const newKey = makeKey({ id: 'new-key-id', publicKey: PUBLIC_KEY_2, keyType: KeyType.ED25519, version: 2, isActive: true });

    beforeEach(() => {
      keysRepo.findActiveByUserId.mockResolvedValue(makeKey());
      keysRepo.findNextVersion.mockResolvedValue(2);
      keysRepo.create.mockReturnValue(newKey);
      keysRepo.save.mockResolvedValue(newKey);
      keysRepo.rotateKeys.mockResolvedValue(undefined);
      bundlesRepo.invalidateByUserId.mockResolvedValue(undefined);
      keysRepo.findByUserAndId.mockResolvedValue(newKey);
    });

    it('creates new key with incremented version', async () => {
      const result = await service.rotateKey(USER_ID, dto);
      expect(result.version).toBe(2);
      expect(keysRepo.rotateKeys).toHaveBeenCalledWith(USER_ID, 'new-key-id');
    });

    it('atomically rotates keys via repository', async () => {
      await service.rotateKey(USER_ID, dto);
      expect(keysRepo.rotateKeys).toHaveBeenCalledWith(USER_ID, newKey.id);
    });

    it('invalidates old prekey bundles on rotation', async () => {
      await service.rotateKey(USER_ID, dto);
      expect(bundlesRepo.invalidateByUserId).toHaveBeenCalledWith(USER_ID);
    });

    it('saves new prekey bundle when provided', async () => {
      const preKeys = [{ keyId: 2, publicKey: 'newprekey==' }];
      bundlesRepo.create.mockReturnValue(makeBundle({ encryptionKeyId: newKey.id }));
      bundlesRepo.save.mockResolvedValue(makeBundle());

      await service.rotateKey(USER_ID, { ...dto, preKeys });

      expect(bundlesRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ userId: USER_ID, preKeys }),
      );
    });

    it('throws NotFoundException when no active key to rotate', async () => {
      keysRepo.findActiveByUserId.mockResolvedValue(null);
      await expect(service.rotateKey(USER_ID, dto)).rejects.toThrow(NotFoundException);
    });

    it('triggers background chain sync for the new key', async () => {
      keysRepo.findOne.mockResolvedValue(newKey);
      soroban.registerKey.mockResolvedValue(true);
      keysRepo.save.mockResolvedValue(newKey);

      await service.rotateKey(USER_ID, dto);
      await new Promise((resolve) => setImmediate(resolve));

      expect(soroban.registerKey).toHaveBeenCalled();
    });
  });

  // ─── getActiveKey ─────────────────────────────────────────────────────────

  describe('getActiveKey', () => {
    it('returns the active key for a user', async () => {
      keysRepo.findActiveByUserId.mockResolvedValue(makeKey());
      const result = await service.getActiveKey(USER_ID);
      expect(result.userId).toBe(USER_ID);
      expect(result.isActive).toBe(true);
    });

    it('throws NotFoundException when no active key exists', async () => {
      keysRepo.findActiveByUserId.mockResolvedValue(null);
      await expect(service.getActiveKey(USER_ID)).rejects.toThrow(NotFoundException);
    });
  });

  // ─── getKeyHistory ────────────────────────────────────────────────────────

  describe('getKeyHistory', () => {
    it('returns all keys for a user ordered by version descending', async () => {
      const keys = [makeKey({ version: 2, isActive: true }), makeKey({ version: 1, isActive: false })];
      keysRepo.findByUserId.mockResolvedValue(keys);

      const result = await service.getKeyHistory(USER_ID);
      expect(result).toHaveLength(2);
      expect(result[0].version).toBe(2);
    });

    it('returns empty array when user has no keys', async () => {
      keysRepo.findByUserId.mockResolvedValue([]);
      const result = await service.getKeyHistory(USER_ID);
      expect(result).toEqual([]);
    });

    it('preserves inactive keys for message decryption history', async () => {
      const keys = [makeKey({ isActive: false, version: 1 })];
      keysRepo.findByUserId.mockResolvedValue(keys);
      const result = await service.getKeyHistory(USER_ID);
      expect(result[0].isActive).toBe(false);
    });
  });

  // ─── revokeKey ────────────────────────────────────────────────────────────

  describe('revokeKey', () => {
    it('deactivates the active key', async () => {
      const key = makeKey();
      keysRepo.findActiveByUserId.mockResolvedValue(key);
      keysRepo.save.mockResolvedValue({ ...key, isActive: false } as EncryptionKey);
      bundlesRepo.invalidateByUserId.mockResolvedValue(undefined);

      await service.revokeKey(USER_ID);

      expect(keysRepo.save).toHaveBeenCalledWith(expect.objectContaining({ isActive: false }));
    });

    it('invalidates prekey bundles on revocation', async () => {
      keysRepo.findActiveByUserId.mockResolvedValue(makeKey());
      keysRepo.save.mockResolvedValue(makeKey({ isActive: false }));
      bundlesRepo.invalidateByUserId.mockResolvedValue(undefined);

      await service.revokeKey(USER_ID);

      expect(bundlesRepo.invalidateByUserId).toHaveBeenCalledWith(USER_ID);
    });

    it('throws NotFoundException when no active key to revoke', async () => {
      keysRepo.findActiveByUserId.mockResolvedValue(null);
      await expect(service.revokeKey(USER_ID)).rejects.toThrow(NotFoundException);
    });

    it('triggers on-chain revocation in background', async () => {
      keysRepo.findActiveByUserId.mockResolvedValue(makeKey());
      keysRepo.save.mockResolvedValue(makeKey({ isActive: false }));
      bundlesRepo.invalidateByUserId.mockResolvedValue(undefined);
      soroban.revokeKey.mockResolvedValue(true);

      await service.revokeKey(USER_ID);
      await new Promise((resolve) => setImmediate(resolve));

      expect(soroban.revokeKey).toHaveBeenCalledWith(USER_ID, PUBLIC_KEY);
    });
  });

  // ─── syncToChain ──────────────────────────────────────────────────────────

  describe('syncToChain', () => {
    it('syncs an unsynced key and marks it as registeredOnChain', async () => {
      const key = makeKey({ registeredOnChain: false });
      keysRepo.findOne.mockResolvedValue(key);
      soroban.registerKey.mockResolvedValue(true);
      keysRepo.save.mockResolvedValue({ ...key, registeredOnChain: true } as EncryptionKey);

      await service.syncToChain(KEY_ID);

      expect(soroban.registerKey).toHaveBeenCalledWith(key);
      expect(keysRepo.save).toHaveBeenCalledWith(expect.objectContaining({ registeredOnChain: true }));
    });

    it('is a noop when key is already synced', async () => {
      keysRepo.findOne.mockResolvedValue(makeKey({ registeredOnChain: true }));

      await service.syncToChain(KEY_ID);

      expect(soroban.registerKey).not.toHaveBeenCalled();
    });

    it('does not update DB when chain sync fails', async () => {
      const key = makeKey({ registeredOnChain: false });
      keysRepo.findOne.mockResolvedValue(key);
      soroban.registerKey.mockResolvedValue(false);

      await service.syncToChain(KEY_ID);

      expect(keysRepo.save).not.toHaveBeenCalled();
    });

    it('throws NotFoundException for unknown key id', async () => {
      keysRepo.findOne.mockResolvedValue(null);
      await expect(service.syncToChain('nonexistent-id')).rejects.toThrow(NotFoundException);
    });
  });

  // ─── getPreKeyBundle ──────────────────────────────────────────────────────

  describe('getPreKeyBundle', () => {
    it('returns the valid prekey bundle for a user', async () => {
      bundlesRepo.findValidByUserId.mockResolvedValue(makeBundle());
      const result = await service.getPreKeyBundle(USER_ID);
      expect(result.userId).toBe(USER_ID);
      expect(result.isValid).toBe(true);
      expect(result.preKeys).toHaveLength(1);
    });

    it('throws NotFoundException when no bundle exists', async () => {
      bundlesRepo.findValidByUserId.mockResolvedValue(null);
      await expect(service.getPreKeyBundle(USER_ID)).rejects.toThrow(NotFoundException);
    });
  });

  // ─── only one active key invariant ────────────────────────────────────────

  describe('one active key per user invariant', () => {
    it('registerKey prevents duplicate active keys', async () => {
      keysRepo.findActiveByUserId.mockResolvedValue(makeKey());
      await expect(
        service.registerKey(USER_ID, { publicKey: PUBLIC_KEY_2, keyType: KeyType.X25519 }),
      ).rejects.toThrow(ConflictException);
    });

    it('rotateKey uses atomic swap to prevent momentary dual-active state', async () => {
      keysRepo.findActiveByUserId.mockResolvedValue(makeKey());
      keysRepo.findNextVersion.mockResolvedValue(2);
      keysRepo.create.mockReturnValue(makeKey({ id: 'new-id', version: 2, isActive: false }));
      keysRepo.save.mockResolvedValue(makeKey({ id: 'new-id', version: 2, isActive: true }));
      keysRepo.rotateKeys.mockResolvedValue(undefined);
      bundlesRepo.invalidateByUserId.mockResolvedValue(undefined);
      keysRepo.findByUserAndId.mockResolvedValue(makeKey({ id: 'new-id', version: 2, isActive: true }));

      await service.rotateKey(USER_ID, { publicKey: PUBLIC_KEY_2, keyType: KeyType.X25519 });

      // new key is inserted as isActive=false first, then rotateKeys atomically swaps
      expect(keysRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ isActive: false }),
      );
      expect(keysRepo.rotateKeys).toHaveBeenCalled();
    });
  });
});
