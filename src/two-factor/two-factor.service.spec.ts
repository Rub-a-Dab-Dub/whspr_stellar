import { Test, TestingModule } from '@nestjs/testing';
import {
  ConflictException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { authenticator } from 'otplib';
import { TwoFactorService } from './two-factor.service';
import { TwoFactorSecret } from './entities/two-factor-secret.entity';
import { UsersService } from '../users/users.service';
import { TranslationService } from '../i18n/services/translation.service';

const USER_ID = 'user-uuid-1';
const JWT_SECRET = 'test-jwt-secret-long-enough-for-scrypt';

const makeRow = (overrides: Partial<TwoFactorSecret> = {}): TwoFactorSecret =>
  ({
    id: 'row-uuid',
    userId: USER_ID,
    secretEncrypted: '',
    backupCodeHashes: [],
    isEnabled: false,
    enabledAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }) as TwoFactorSecret;

describe('TwoFactorService', () => {
  let service: TwoFactorService;
  let repo: {
    findOne: jest.Mock;
    save: jest.Mock;
    create: jest.Mock;
    delete: jest.Mock;
  };

  beforeEach(async () => {
    repo = {
      findOne: jest.fn(),
      save: jest.fn(),
      create: jest.fn(),
      delete: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TwoFactorService,
        { provide: getRepositoryToken(TwoFactorSecret), useValue: repo },
        {
          provide: ConfigService,
          useValue: { get: (k: string) => (k === 'JWT_SECRET' ? JWT_SECRET : undefined) },
        },
        {
          provide: UsersService,
          useValue: { findById: jest.fn().mockResolvedValue({ walletAddress: 'GTEST...' }) },
        },
        {
          provide: TranslationService,
          useValue: { translate: (k: string) => k },
        },
      ],
    }).compile();

    service = module.get(TwoFactorService);
  });

  describe('isEnabled', () => {
    it('returns true when row exists and isEnabled', async () => {
      repo.findOne.mockResolvedValue(makeRow({ isEnabled: true }));
      expect(await service.isEnabled(USER_ID)).toBe(true);
    });

    it('returns false when no row exists', async () => {
      repo.findOne.mockResolvedValue(null);
      expect(await service.isEnabled(USER_ID)).toBe(false);
    });

    it('returns false when row is not enabled', async () => {
      repo.findOne.mockResolvedValue(makeRow({ isEnabled: false }));
      expect(await service.isEnabled(USER_ID)).toBe(false);
    });
  });

  describe('setup', () => {
    it('throws ConflictException when 2FA already enabled', async () => {
      repo.findOne.mockResolvedValue(makeRow({ isEnabled: true }));
      await expect(service.setup(USER_ID)).rejects.toThrow(ConflictException);
    });

    it('returns otpauthUrl and manualEntryKey on fresh setup', async () => {
      repo.findOne.mockResolvedValue(null);
      repo.create.mockReturnValue(makeRow());
      repo.save.mockResolvedValue(makeRow());

      const result = await service.setup(USER_ID);

      expect(result.otpauthUrl).toContain('otpauth://');
      expect(result.manualEntryKey).toBeTruthy();
    });

    it('updates existing pending row instead of creating new', async () => {
      const existing = makeRow({ isEnabled: false, secretEncrypted: 'old' });
      repo.findOne.mockResolvedValue(existing);
      repo.save.mockResolvedValue(existing);

      const result = await service.setup(USER_ID);

      expect(repo.create).not.toHaveBeenCalled();
      expect(repo.save).toHaveBeenCalled();
      expect(result.manualEntryKey).toBeTruthy();
    });
  });

  describe('enable', () => {
    it('throws NotFoundException when no pending row', async () => {
      repo.findOne.mockResolvedValue(null);
      await expect(service.enable(USER_ID, '123456')).rejects.toThrow(NotFoundException);
    });

    it('throws ConflictException when already enabled', async () => {
      repo.findOne.mockResolvedValue(makeRow({ isEnabled: true }));
      await expect(service.enable(USER_ID, '123456')).rejects.toThrow(ConflictException);
    });

    it('throws UnauthorizedException for invalid TOTP code', async () => {
      // Create a real encrypted secret so decryption works
      const setup = await setupAndGetSecret();
      repo.findOne.mockResolvedValue(setup.row);

      await expect(service.enable(USER_ID, '000000')).rejects.toThrow(UnauthorizedException);
    });

    it('enables 2FA and returns backup codes on valid TOTP', async () => {
      const { row, plainSecret } = await setupAndGetSecret();
      const validCode = authenticator.generate(plainSecret);
      repo.findOne.mockResolvedValue(row);
      repo.save.mockResolvedValue({ ...row, isEnabled: true });

      const result = await service.enable(USER_ID, validCode);

      expect(result.backupCodes).toHaveLength(10);
      expect(repo.save).toHaveBeenCalled();
    });
  });

  describe('disable', () => {
    it('throws NotFoundException when 2FA not enabled', async () => {
      repo.findOne.mockResolvedValue(null);
      await expect(service.disable(USER_ID, '123456')).rejects.toThrow(NotFoundException);
    });

    it('throws UnauthorizedException for invalid code', async () => {
      const { row } = await setupAndGetSecret(true);
      repo.findOne.mockResolvedValue(row);

      await expect(service.disable(USER_ID, '000000')).rejects.toThrow(UnauthorizedException);
    });

    it('deletes row on valid TOTP code', async () => {
      const { row, plainSecret } = await setupAndGetSecret(true);
      const validCode = authenticator.generate(plainSecret);
      repo.findOne.mockResolvedValue(row);
      repo.delete.mockResolvedValue({ affected: 1 });

      await service.disable(USER_ID, validCode);

      expect(repo.delete).toHaveBeenCalledWith({ userId: USER_ID });
    });
  });

  describe('getBackupCodesMeta', () => {
    it('throws NotFoundException when not enabled', async () => {
      repo.findOne.mockResolvedValue(null);
      await expect(service.getBackupCodesMeta(USER_ID)).rejects.toThrow(NotFoundException);
    });

    it('returns remaining backup code count', async () => {
      const row = makeRow({ isEnabled: true, backupCodeHashes: ['h1', 'h2', 'h3'] });
      repo.findOne.mockResolvedValue(row);

      const result = await service.getBackupCodesMeta(USER_ID);
      expect(result.remaining).toBe(3);
    });
  });

  describe('regenerateBackupCodes', () => {
    it('throws NotFoundException when not enabled', async () => {
      repo.findOne.mockResolvedValue(null);
      await expect(service.regenerateBackupCodes(USER_ID)).rejects.toThrow(NotFoundException);
    });

    it('generates 10 new backup codes and saves', async () => {
      const row = makeRow({ isEnabled: true });
      repo.findOne.mockResolvedValue(row);
      repo.save.mockResolvedValue(row);

      const result = await service.regenerateBackupCodes(USER_ID);

      expect(result.backupCodes).toHaveLength(10);
      expect(repo.save).toHaveBeenCalled();
    });
  });

  describe('assertValidLoginCode', () => {
    it('throws UnauthorizedException when 2FA not enabled', async () => {
      repo.findOne.mockResolvedValue(null);
      await expect(service.assertValidLoginCode(USER_ID, '123456')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('throws UnauthorizedException for wrong code', async () => {
      const { row } = await setupAndGetSecret(true);
      repo.findOne.mockResolvedValue(row);

      await expect(service.assertValidLoginCode(USER_ID, '000000')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('resolves without error for valid TOTP', async () => {
      const { row, plainSecret } = await setupAndGetSecret(true);
      const validCode = authenticator.generate(plainSecret);
      repo.findOne.mockResolvedValue(row);
      repo.save.mockResolvedValue(row);

      await expect(service.assertValidLoginCode(USER_ID, validCode)).resolves.not.toThrow();
    });
  });

  describe('backup code redemption', () => {
    it('redeems a valid backup code and invalidates it', async () => {
      const plainCode = 'ABCDEFGHIJ';
      const hash = await bcrypt.hash(plainCode, 10);
      const { row } = await setupAndGetSecret(true);
      row.backupCodeHashes = [hash];
      repo.findOne.mockResolvedValue(row);
      repo.save.mockResolvedValue({ ...row, backupCodeHashes: [] });

      await expect(service.assertValidLoginCode(USER_ID, plainCode)).resolves.not.toThrow();
      expect(repo.save).toHaveBeenCalledWith(
        expect.objectContaining({ backupCodeHashes: [] }),
      );
    });
  });

  // Helper: sets up a real encrypted secret via service.setup, returns row + plainSecret
  async function setupAndGetSecret(enabled = false): Promise<{
    row: TwoFactorSecret;
    plainSecret: string;
  }> {
    let capturedSecret = '';
    let capturedEncrypted = '';

    // Intercept save to capture the encrypted secret
    repo.findOne.mockResolvedValue(null);
    repo.create.mockImplementation((data: any) => ({ ...makeRow(), ...data }));
    repo.save.mockImplementation(async (row: any) => {
      capturedEncrypted = row.secretEncrypted;
      return row;
    });

    const setupResult = await service.setup(USER_ID);
    capturedSecret = setupResult.manualEntryKey;

    const row = makeRow({ secretEncrypted: capturedEncrypted, isEnabled: enabled });

    return { row, plainSecret: capturedSecret };
  }
});
